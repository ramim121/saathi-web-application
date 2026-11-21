import React, { useEffect, useRef, useState } from "react";
import MainLayout from "@/layouts/MainLayout";
import { Modal } from "react-bootstrap";
import { getRequestOptions, postRequestOptions } from "@/utils/Fetch";
import Swal from "sweetalert2";
import UserType from "@/types/User";
import { S3_URL } from '@/config/public';
import { NextPage, GetServerSidePropsContext } from "next";
import { API_URL } from '@/config/public';
import { requireAdminPage, redirectToLogin } from "@/utils/pageAuth";
// listUsers is server-only and used only in getServerSideProps, so Next drops it
// from the browser bundle; the page size comes from a browser-safe module.
import { listUsers } from "@/utils/adminUsers";
import { USERS_PAGE_SIZE } from "@/utils/adminUsersShared";
import { Check, Landmark, Loader2, X } from "lucide-react";
import { Avatar, Pill, Skeleton, cx } from "@/ui/primitives";
import { Button, Field, Input, Select } from "@/ui/controls";
import { EmptyRow, PageHeader, TableCard, TD, TH, TR } from "@/ui/layout";
import { ListFooter, ListToolbar, SortTH, filterChips, useListState } from "@/ui/table";
import { capitalise, dhakaDmy } from "@/ui/status";
import { date } from "@/ui/format";

/**
 * Users (investors, partners, admins). Redesigned 2026-11-17; the filters,
 * paging, verification actions and both dialogs behave as before.
 *
 * Changes that are not just looks:
 * - the joining date is formatted in Asia/Dhaka (display and filter alike) —
 *   the viewer's own timezone made the server and browser render different
 *   text, which broke hydration for admins in Bangladesh;
 * - users without a photo get their initials, not a random image fetched from
 *   picsum.photos;
 * - since 2026-11-18 the table loads one page at a time (api/admin/users) with
 *   the same filters, applied by the database, and the dialogs load the one
 *   user they show. The page used to carry every user with every column:
 *   600 kB of page data at ~600 users;
 * - since 2026-11-19 one search box (name, phone, email or user number)
 *   replaces the separate name and phone/email boxes, the other filters sit
 *   behind Filters with a chip for each one applied, columns sort, the rows
 *   per page can change, and the list state is kept in the URL.
 */

type Row = UserType & { bankCount?: number };
type UsersPage = { data: Row[]; total: number; page: number; totalPages: number };

interface UserListProps {
    initial: UsersPage;
}

const DEFAULTS = {
    q: "",
    userType: "",
    status: "",
    age: "",
    joining: "",
    nid: "",
    email: "",
    phone: "",
    orderBy: "idUsers",
    orderType: "DESC" as "ASC" | "DESC",
    page: 1,
    pageSize: USERS_PAGE_SIZE,
};
const DEFAULT_QUERY = new URLSearchParams(Object.entries(DEFAULTS).map(([k, v]) => [k, String(v)])).toString();
const VERIFIED = (what: string) => (v: string) => `${what} ${v === "yes" ? "verified" : "not verified"}`;

/**
 * The three verification states as compact ticks. Green means verified, grey
 * means not — never red: an unverified account is a normal state on the way
 * in, not an error.
 */
function VerifyTicks({ nid, phone, email }: { nid: boolean; phone: boolean; email: boolean }) {
    const items: Array<[string, string, boolean]> = [
        ["NID", "N", nid],
        ["Phone", "P", phone],
        ["Email", "E", email],
    ];
    return (
        <span className="tw-inline-flex tw-gap-1">
            {items.map(([label, letter, ok]) => (
                <span
                    key={label}
                    title={`${label} ${ok ? "verified" : "not verified"}`}
                    className={cx(
                        "tw-inline-flex tw-items-center tw-gap-0.5 tw-rounded-full tw-px-1.5 tw-py-0.5 tw-text-[11px] tw-font-semibold",
                        ok ? "tw-bg-emerald-50 tw-text-emerald-700" : "tw-bg-slate-100 tw-text-slate-400",
                    )}
                >
                    {letter}
                    {ok ? <Check className="tw-h-3 tw-w-3" aria-hidden /> : <span aria-hidden>·</span>}
                    <span className="tw-sr-only">
                        {label} {ok ? "verified" : "not verified"}
                    </span>
                </span>
            ))}
        </span>
    );
}

function Photo({ user, size }: { user: UserType; size: "sm" | "lg" }) {
    const dims = size === "lg" ? "tw-h-20 tw-w-20" : "tw-h-9 tw-w-9";
    if (user.profileImage) {
        return (
            // eslint-disable-next-line @next/next/no-img-element
            <img alt="" src={`${S3_URL}profile/${user.profileImage}`} className={cx(dims, "tw-shrink-0 tw-rounded-full tw-object-cover tw-ring-1 tw-ring-slate-200")} />
        );
    }
    return <Avatar name={user.fullName || user.email || String(user.idUsers)} seed={user.idUsers} size={size === "lg" ? "lg" : "sm"} />;
}

function Verified({ ok }: { ok: boolean }) {
    return ok ? <Pill tone="green">Verified</Pill> : <Pill tone="slate">Not verified</Pill>;
}

const UserList: NextPage<UserListProps> = ({ initial }) => {
    const [rows, setRows] = useState<Row[]>(initial.data);
    const [total, setTotal] = useState(initial.total);
    const list = useListState(DEFAULTS);
    const { state, update } = list;
    const [reloadKey, setReloadKey] = useState(0);
    const [listLoading, setListLoading] = useState(false);
    const [details, setDetails] = useState<Record<number, UserType>>({});
    const [selectedUser, setSelectedUser] = useState<UserType | null>(null);
    const [showUserDetailsModal, setShowUserDetailsModal] = useState(false);
    const [showBankModal, setShowBankModal] = useState(false);
    const [bankModalUser, setBankModalUser] = useState<UserType | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    // The first page arrives with the HTML; after that every change fetches
    // (typing waits 300 ms, in useListState). An answer to an older request is
    // dropped when a newer one has been sent.
    const servedFirst = useRef(true);
    useEffect(() => {
        if (!list.ready) return;
        if (servedFirst.current) {
            servedFirst.current = false;
            if (list.query === DEFAULT_QUERY) return;
        }
        let stale = false;
        (async () => {
            setListLoading(true);
            try {
                const res = await fetch(`/api/admin/users?${list.query}`, getRequestOptions());
                const data = await res.json();
                if (stale) return;
                if (!res.ok) {
                    Swal.fire("Error", data.message || "Could not load users", "error");
                    return;
                }
                // A verification can drop the last row of the last page out of the filter.
                if (data.data.length === 0 && list.settled.page > 1 && data.total > 0) {
                    update({ page: Math.max(1, data.totalPages) });
                    return;
                }
                setRows(data.data);
                setTotal(data.total);
            } catch (error) {
                if (!stale) Swal.fire("Error", "Could not load users", "error");
            } finally {
                if (!stale) setListLoading(false);
            }
        })();
        return () => {
            stale = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [list.query, list.ready, reloadKey]);

    /** One user's full record, fetched once and kept for both dialogs. */
    const ensureDetails = async (idUsers: number): Promise<UserType | null> => {
        if (details[idUsers]) return details[idUsers];
        try {
            const res = await fetch(`/api/admin/users/${idUsers}`, getRequestOptions());
            const data = await res.json();
            if (!res.ok) {
                Swal.fire("Error", data.message || "Could not load this user", "error");
                return null;
            }
            setDetails((d) => ({ ...d, [idUsers]: data.data }));
            setSelectedUser((s) => (s && s.idUsers === idUsers ? { ...s, ...data.data } : s));
            return data.data;
        } catch {
            Swal.fire("Error", "Could not load this user", "error");
            return null;
        }
    };

    const verifyUserInformation = async (idUsers: number, verificationType: string, verificationStatus: string = "") => {
        try {
            setIsLoading(true);
            let response = await fetch(
                API_URL + "api/verify",
                postRequestOptions({ idUsers, verificationType, verificationStatus })
            );
            let data = await response.json();
            setIsLoading(false);
            if (data.success) {
                Swal.fire("Success", data.message, "success");
                setSelectedUser(data.userData);
                setDetails((d) => ({ ...d, [idUsers]: { ...d[idUsers], ...data.userData } }));
                setRows((list) => list.map((user) => (user.idUsers === idUsers ? { ...user, ...data.userData } : user)));
                // The change may move the user out of the current filter.
                setReloadKey((k) => k + 1);
            } else {
                Swal.fire("Error", data.message, "error");
            }
        } catch (error) {
            setIsLoading(false);
            console.error(error);
            Swal.fire("Error", "Something went wrong", "error");
        }
    };

    const field = (key: keyof typeof DEFAULTS) => ({
        value: state[key] as string,
        onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => update({ [key]: e.target.value } as Partial<typeof DEFAULTS>, { typing: e.target.tagName === "INPUT" }),
    });
    const chips = filterChips(state, list.defaults, {
        userType: (v) => `Type: ${capitalise(v)}`,
        status: (v) => `Status: ${capitalise(v)}`,
        age: "Age",
        joining: "Joined",
        nid: VERIFIED("NID"),
        email: VERIFIED("Email"),
        phone: VERIFIED("Phone"),
    }, update);
    const filtered = chips.length > 0 || state.q.trim() !== "";

    const openDetails = (user: Row) => {
        setSelectedUser(details[user.idUsers] ? { ...user, ...details[user.idUsers] } : user);
        setShowUserDetailsModal(true);
        void ensureDetails(user.idUsers);
    };

    const openBanks = (user: Row) => {
        setBankModalUser(user);
        setShowBankModal(true);
        void ensureDetails(user.idUsers);
    };

    const selectedLoaded = Boolean(selectedUser && details[selectedUser.idUsers]);
    const bankDetails = bankModalUser ? details[bankModalUser.idUsers] : undefined;

    return (
        <div className="ui">
            <PageHeader
                eyebrow="People"
                title="Investors & users"
                description="Everyone with an account — investors, partners and admins. Open a name for details and verification."
                actions={
                    <span className="tw-inline-flex tw-items-center tw-gap-1.5 tw-rounded-lg tw-bg-white tw-px-2.5 tw-py-1.5 tw-text-xs tw-font-medium tw-tabular-nums tw-text-slate-600 tw-ring-1 tw-ring-slate-200">
                        {listLoading && <Loader2 className="tw-h-3 tw-w-3 tw-animate-spin tw-text-slate-400" aria-hidden />}
                        {total.toLocaleString("en-IN")} {filtered ? "matching" : "users"}
                    </span>
                }
            />

            <TableCard
                toolbar={
                    <ListToolbar
                        search={state.q}
                        onSearch={(q) => update({ q }, { typing: true })}
                        placeholder="Name, phone, email or user #"
                        chips={chips}
                        onReset={() => list.reset()}
                        filters={
                            <>
                                <Field label="User type">
                                    <Select {...field("userType")}>
                                        <option value="">All</option>
                                        <option value="admin">Admin</option>
                                        <option value="investor">Investor</option>
                                        <option value="partner">Partner</option>
                                    </Select>
                                </Field>
                                <Field label="Status">
                                    <Select {...field("status")}>
                                        <option value="">All</option>
                                        <option value="active">Active</option>
                                        <option value="inactive">Inactive</option>
                                        <option value="deleted">Deleted</option>
                                    </Select>
                                </Field>
                                <Field label="Age">
                                    <Input type="text" inputMode="numeric" placeholder="e.g. 32" {...field("age")} />
                                </Field>
                                <Field label="Joining date" hint="d/m/yyyy, or part of it">
                                    <Input type="text" placeholder="e.g. 12/8/2026" {...field("joining")} />
                                </Field>
                                <Field label="NID">
                                    <Select {...field("nid")}>
                                        <option value="">All</option>
                                        <option value="yes">Verified</option>
                                        <option value="no">Not verified</option>
                                    </Select>
                                </Field>
                                <Field label="Email">
                                    <Select {...field("email")}>
                                        <option value="">All</option>
                                        <option value="yes">Verified</option>
                                        <option value="no">Not verified</option>
                                    </Select>
                                </Field>
                                <Field label="Phone">
                                    <Select {...field("phone")}>
                                        <option value="">All</option>
                                        <option value="yes">Verified</option>
                                        <option value="no">Not verified</option>
                                    </Select>
                                </Field>
                            </>
                        }
                    />
                }
                footer={<ListFooter page={state.page} pageSize={state.pageSize} total={total} loading={listLoading} noun="users" onPage={(page) => update({ page })} onPageSize={(pageSize) => update({ pageSize })} />}
            >
                <thead>
                    <tr>
                        <SortTH label="#" field="idUsers" sort={state} onSort={list.sortBy} className="tw-w-16" />
                        <SortTH label="User" field="fullName" sort={state} onSort={list.sortBy} />
                        <th className={TH}>Contact</th>
                        <SortTH label="Age" field="age" sort={state} onSort={list.sortBy} />
                        <SortTH label="Joined" field="createdAt" sort={state} onSort={list.sortBy} />
                        <th className={TH}>Disability</th>
                        <SortTH label="Status" field="status" sort={state} onSort={list.sortBy} />
                        <th className={TH}>Verified</th>
                        <th className={TH}>Bank</th>
                    </tr>
                </thead>
                <tbody className={cx("tw-transition-opacity", listLoading && "tw-opacity-60")} aria-busy={listLoading}>
                    {rows.length > 0 ? (
                        rows.map((user) => (
                            <tr key={user.idUsers} className={TR}>
                                <td className={cx(TD, "tw-tabular-nums tw-text-slate-400")}>{user.idUsers}</td>
                                <td className={TD}>
                                    <button type="button" onClick={() => openDetails(user)} className="tw-group tw-flex tw-items-center tw-gap-3 tw-text-left">
                                        <Photo user={user} size="sm" />
                                        <span className="tw-min-w-0">
                                            <span className="tw-block tw-whitespace-nowrap tw-font-medium tw-text-slate-900 group-hover:tw-text-brand-700">
                                                {user.fullName || <span className="tw-text-slate-400">No name</span>}
                                            </span>
                                            <span className="tw-block tw-text-xs tw-capitalize tw-text-slate-500">{user.userType}</span>
                                        </span>
                                    </button>
                                </td>
                                <td className={cx(TD, "tw-text-slate-600")}>
                                    <span className="tw-block tw-tabular-nums">{user.phoneNumber}</span>
                                    <span className="tw-block tw-text-xs tw-text-slate-500">{user.email}</span>
                                </td>
                                <td className={cx(TD, "tw-tabular-nums tw-text-slate-600")}>{user.age ?? <span className="tw-text-slate-300">—</span>}</td>
                                <td className={cx(TD, "tw-whitespace-nowrap tw-tabular-nums tw-text-slate-600")}>{dhakaDmy(user.createdAt)}</td>
                                <td className={cx(TD, "tw-capitalize tw-text-slate-600")}>{user.disability}</td>
                                <td className={TD}>
                                    <Pill tone={user.status === "active" ? "green" : user.status === "deleted" ? "rose" : "slate"}>{capitalise(user.status)}</Pill>
                                </td>
                                <td className={cx(TD, "tw-whitespace-nowrap")}>
                                    <VerifyTicks nid={user.nidVerified === "yes"} phone={user.phoneVerified === "yes"} email={user.emailVerified === "yes"} />
                                </td>
                                <td className={TD}>
                                    {(user.bankCount ?? 0) > 0 ? (
                                        <button
                                            type="button"
                                            onClick={() => openBanks(user)}
                                            className="tw-inline-flex tw-items-center tw-gap-1.5 tw-whitespace-nowrap tw-rounded-lg tw-px-2 tw-py-1 tw-text-xs tw-font-semibold tw-text-brand-700 hover:tw-bg-brand-50"
                                        >
                                            <Landmark className="tw-h-3.5 tw-w-3.5" aria-hidden /> View
                                        </button>
                                    ) : (
                                        <span className="tw-text-slate-300">—</span>
                                    )}
                                </td>
                            </tr>
                        ))
                    ) : (
                        <EmptyRow colSpan={9} title="No users match" hint={filtered ? "Try fewer filters." : undefined} />
                    )}
                </tbody>
            </TableCard>

            {selectedUser && (
                <Modal size="lg" show={showUserDetailsModal} onHide={() => setShowUserDetailsModal(false)}>
                    <Modal.Body className="tw-p-0">
                        <div className="ui">
                            <div className="tw-flex tw-items-start tw-gap-4 tw-border-b tw-border-slate-100 tw-p-6">
                                <Photo user={selectedUser} size="lg" />
                                <div className="tw-min-w-0 tw-flex-1">
                                    <div className="tw-flex tw-items-start tw-justify-between tw-gap-3">
                                        <div>
                                            <h2 className="tw-text-lg tw-font-semibold tw-text-slate-900">{selectedUser.fullName || "No name"}</h2>
                                            <p className="tw-text-sm tw-capitalize tw-text-slate-500">
                                                {selectedUser.userType} · #{selectedUser.idUsers}
                                            </p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setShowUserDetailsModal(false)}
                                            className="tw-rounded-lg tw-p-1.5 tw-text-slate-400 hover:tw-bg-slate-100 hover:tw-text-slate-600"
                                            aria-label="Close"
                                        >
                                            <X className="tw-h-5 tw-w-5" aria-hidden />
                                        </button>
                                    </div>
                                    <div className="tw-mt-3 tw-space-y-2 tw-text-sm">
                                        <div className="tw-flex tw-flex-wrap tw-items-center tw-gap-2">
                                            <span className="tw-w-14 tw-text-slate-500">Email</span>
                                            <span className="tw-text-slate-800">{selectedUser.email || "—"}</span>
                                            <Verified ok={selectedUser.emailVerified == "yes"} />
                                            {selectedUser.emailVerified != "yes" && (
                                                <Button size="sm" variant="primary" disabled={isLoading} onClick={() => { verifyUserInformation(selectedUser.idUsers, "email") }}>
                                                    Mark as verified
                                                </Button>
                                            )}
                                        </div>
                                        <div className="tw-flex tw-flex-wrap tw-items-center tw-gap-2">
                                            <span className="tw-w-14 tw-text-slate-500">Phone</span>
                                            <span className="tw-tabular-nums tw-text-slate-800">{selectedUser.phoneNumber || "—"}</span>
                                            <Verified ok={selectedUser.phoneVerified == "yes"} />
                                            {selectedUser.phoneVerified != "yes" && (
                                                <Button size="sm" variant="primary" disabled={isLoading} onClick={() => { verifyUserInformation(selectedUser.idUsers, "phone") }}>
                                                    Mark as verified
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {selectedLoaded ? (
                                <>
                                    <dl className="tw-grid tw-grid-cols-1 tw-gap-x-6 tw-gap-y-3 tw-p-6 tw-text-sm sm:tw-grid-cols-2">
                                        {(
                                            [
                                                ["Date of birth", selectedUser.dateOfBirth ? date(String(selectedUser.dateOfBirth)) : "—"],
                                                ["Age", selectedUser.age],
                                                ["Location", selectedUser.location],
                                                ["Role", selectedUser.role],
                                                ["Education", selectedUser.education],
                                                ["Disability", selectedUser.disability],
                                                ["Partner type", selectedUser.partnerType],
                                                ["Interested in", selectedUser.interestedIn],
                                                ["Skills", selectedUser.skills],
                                            ] as [string, React.ReactNode][]
                                        ).map(([label, value]) => (
                                            <div key={label}>
                                                <dt className="tw-text-xs tw-font-medium tw-text-slate-500">{label}</dt>
                                                <dd className="tw-mt-0.5 tw-text-slate-800">{value || "—"}</dd>
                                            </div>
                                        ))}
                                        <div className="sm:tw-col-span-2">
                                            <dt className="tw-text-xs tw-font-medium tw-text-slate-500">Bio</dt>
                                            <dd className="tw-mt-0.5 tw-whitespace-pre-line tw-text-slate-800">{selectedUser.bio || "—"}</dd>
                                        </div>
                                    </dl>

                                    {selectedUser.nidVerificationStatus != "none" && (
                                        <div className="tw-border-t tw-border-slate-100 tw-p-6">
                                            <div className="tw-flex tw-flex-wrap tw-items-center tw-gap-2">
                                                <h3 className="tw-text-sm tw-font-semibold tw-text-slate-900">NID</h3>
                                                <span className="tw-text-sm tw-tabular-nums tw-text-slate-600">{selectedUser.nidNumber}</span>
                                                {selectedUser.nidVerified == "yes" ? (
                                                    <Pill tone="green">Verified</Pill>
                                                ) : (
                                                    <Pill tone={selectedUser.nidVerificationStatus == "rejected" ? "rose" : "amber"}>{capitalise(selectedUser.nidVerificationStatus)}</Pill>
                                                )}
                                                {selectedUser.nidVerified != "yes" && selectedUser.nidVerificationStatus == "pending" && (
                                                    <span className="tw-ml-auto tw-flex tw-gap-2">
                                                        <Button size="sm" variant="success" disabled={isLoading} onClick={() => { verifyUserInformation(selectedUser.idUsers, "nid", "approved") }}>
                                                            Approve
                                                        </Button>
                                                        <Button size="sm" variant="danger" disabled={isLoading} onClick={() => { verifyUserInformation(selectedUser.idUsers, "nid", "rejected") }}>
                                                            Reject
                                                        </Button>
                                                    </span>
                                                )}
                                            </div>
                                            {/* Served through an authenticated route rather than the
                                                public bucket URL. These are national ID cards; the route
                                                checks that the caller is the owner or an admin and
                                                redirects to a five-minute presigned URL. It takes the
                                                user id, not a filename, so a leaked filename grants
                                                nothing. */}
                                            <div className="tw-mt-4 tw-grid tw-grid-cols-1 tw-gap-3 sm:tw-grid-cols-2">
                                                {(["front", "back"] as const).map((side) => (
                                                    <figure key={side} className="tw-overflow-hidden tw-rounded-xl tw-border tw-border-slate-200 tw-bg-slate-50">
                                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                                        <img className="tw-w-full" src={`/api/files/nid/${selectedUser.idUsers}?side=${side}`} alt={`NID ${side}`} />
                                                        <figcaption className="tw-border-t tw-border-slate-200 tw-px-3 tw-py-1.5 tw-text-xs tw-capitalize tw-text-slate-500">{side}</figcaption>
                                                    </figure>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <div className="tw-grid tw-grid-cols-1 tw-gap-x-6 tw-gap-y-4 tw-p-6 sm:tw-grid-cols-2" aria-busy="true" aria-label="Loading details">
                                    {[0, 1, 2, 3, 4, 5].map((i) => (
                                        <div key={i} className="tw-space-y-1.5">
                                            <Skeleton className="tw-h-3 tw-w-20" />
                                            <Skeleton className="tw-h-4 tw-w-40" />
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </Modal.Body>
                </Modal>
            )}
            {bankModalUser && (
                <Modal size="lg" show={showBankModal} onHide={() => setShowBankModal(false)}>
                    <Modal.Header closeButton>
                        <Modal.Title>Bank information — {bankModalUser.fullName}</Modal.Title>
                    </Modal.Header>
                    <Modal.Body>
                        <div className="ui tw-space-y-3">
                            {!bankDetails ? (
                                <div className="tw-space-y-2" aria-busy="true" aria-label="Loading bank information">
                                    <Skeleton className="tw-h-4 tw-w-48" />
                                    <Skeleton className="tw-h-4 tw-w-64" />
                                </div>
                            ) : (bankDetails.UserBanks ?? []).length === 0 ? (
                                <p className="tw-text-sm tw-text-slate-500">No bank account on file.</p>
                            ) : (
                                (bankDetails.UserBanks ?? []).map((ub, i) => (
                                    <dl key={i} className="tw-grid tw-grid-cols-1 tw-gap-x-6 tw-gap-y-2 tw-rounded-xl tw-border tw-border-slate-200 tw-p-4 tw-text-sm sm:tw-grid-cols-2">
                                        <div>
                                            <dt className="tw-text-xs tw-font-medium tw-text-slate-500">Account name</dt>
                                            <dd className="tw-mt-0.5 tw-text-slate-800">{ub.accountHolderName}</dd>
                                        </div>
                                        <div>
                                            <dt className="tw-text-xs tw-font-medium tw-text-slate-500">Account number</dt>
                                            <dd className="tw-mt-0.5 tw-tabular-nums tw-text-slate-800">{ub.accountNumber}</dd>
                                        </div>
                                        {ub.Bank && (
                                            <div>
                                                <dt className="tw-text-xs tw-font-medium tw-text-slate-500">Bank</dt>
                                                <dd className="tw-mt-0.5 tw-text-slate-800">
                                                    {ub.Bank.bankNameFull} ({ub.Bank.bankNameShort})
                                                </dd>
                                            </div>
                                        )}
                                        {ub.BankBranch && (
                                            <>
                                                <div>
                                                    <dt className="tw-text-xs tw-font-medium tw-text-slate-500">Branch</dt>
                                                    <dd className="tw-mt-0.5 tw-text-slate-800">{ub.BankBranch.branchName}</dd>
                                                </div>
                                                <div>
                                                    <dt className="tw-text-xs tw-font-medium tw-text-slate-500">Routing number</dt>
                                                    <dd className="tw-mt-0.5 tw-tabular-nums tw-text-slate-800">{ub.BankBranch.routingNumber}</dd>
                                                </div>
                                            </>
                                        )}
                                    </dl>
                                ))
                            )}
                        </div>
                    </Modal.Body>
                </Modal>
            )}
        </div>
    );
};

export default UserList;

// @ts-ignore
UserList.getLayout = function PageLayout(page: any) {
    return <MainLayout>{page}</MainLayout>;
};

export async function getServerSideProps(context: GetServerSidePropsContext) {
    // This query runs before any client-side layout check, and its result is
    // embedded in the served HTML — so without this guard user data would be
    // readable by an anonymous request.
    if (!requireAdminPage(context)) return redirectToLogin;

    const initial = await listUsers({}, 1, USERS_PAGE_SIZE);
    return {
        props: {
            initial: JSON.parse(JSON.stringify(initial)),
        },
    };
}
