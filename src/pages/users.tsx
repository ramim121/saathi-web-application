import React, { useState, useEffect } from "react";
import MainLayout from "@/layouts/MainLayout";
import { Modal } from "react-bootstrap";
import { postRequestOptions } from "@/utils/Fetch";
import Swal from "sweetalert2";
import { User, UserBank, Bank, BankBranch } from "@/models/__associations";
import UserType from "@/types/User";
import { S3_URL } from '@/config/public';
import { NextPage, GetServerSidePropsContext } from "next";
import { API_URL } from '@/config/public';
import { requireAdminPage, redirectToLogin } from "@/utils/pageAuth";
import { Check, Landmark, RotateCcw, X } from "lucide-react";
import { Avatar, Pill, cx } from "@/ui/primitives";
import { Button, Field, Input, SearchInput, Select } from "@/ui/controls";
import { EmptyRow, PageHeader, Pager, TableCard, TD, TH, TR } from "@/ui/layout";
import { capitalise, dhakaDmy } from "@/ui/status";
import { date } from "@/ui/format";

/**
 * Users (investors, partners, admins). Redesigned 2026-11-17; the filters,
 * paging, verification actions and both dialogs behave exactly as before.
 *
 * Changes that are not just looks:
 * - the joining date is formatted in Asia/Dhaka (display and filter alike) —
 *   the viewer's own timezone made the server and browser render different
 *   text, which broke hydration for admins in Bangladesh;
 * - users without a photo get their initials, not a random image fetched from
 *   picsum.photos;
 * - the server-side query no longer ships password hashes to the browser.
 */

interface UserListProps {
    users: UserType[];
}

const EMPTY_FILTERS = {
    name: "",
    phoneEmail: "",
    userType: "",
    age: "",
    joining: "",
    partnerType: "",
    status: "",
    nid: "",
    email: "",
    phone: "",
};

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

const UserList: NextPage<UserListProps> = ({ users }) => {
    const [usersList, setUsersList] = useState<UserType[]>(users);
    const [filteredUsers, setFilteredUsers] = useState<UserType[]>(users);
    const [selectedUser, setSelectedUser] = useState<UserType | null>(null);
    const [showUserDetailsModal, setShowUserDetailsModal] = useState(false);
    const [showBankModal, setShowBankModal] = useState(false);
    const [bankModalUser, setBankModalUser] = useState<UserType | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [filters, setFilters] = useState(EMPTY_FILTERS);

    const [currentPage, setCurrentPage] = useState(1);
    const usersPerPage = 10;

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
                let updatedUsers = usersList.map((user) => {
                    if (user.idUsers === idUsers) {
                        return { ...user, ...data.userData };
                    }
                    return user;
                });
                setUsersList(updatedUsers);
            } else {
                Swal.fire("Error", data.message, "error");
            }
        } catch (error) {
            setIsLoading(false);
            console.error(error);
            Swal.fire("Error", "Something went wrong", "error");
        }
    };

    useEffect(() => {
        let tempUsers = [...usersList];

        if (filters.name) {
            tempUsers = tempUsers.filter(
                (user) =>
                    user.fullName &&
                    user.fullName.toLowerCase().includes(filters.name.toLowerCase())
            );
        }
        if (filters.phoneEmail) {
            tempUsers = tempUsers.filter(
                (user) =>
                    (user.phoneNumber &&
                        user.phoneNumber.toLowerCase().includes(filters.phoneEmail.toLowerCase())) ||
                    (user.email && user.email.toLowerCase().includes(filters.phoneEmail.toLowerCase()))
            );
        }
        if (filters.userType) {
            tempUsers = tempUsers.filter(
                (user) =>
                    user.userType &&
                    user.userType.toLowerCase().includes(filters.userType.toLowerCase())
            );
        }
        if (filters.age) {
            tempUsers = tempUsers.filter((user) => user.age && user.age.toString() === filters.age);
        }
        if (filters.joining) {
            tempUsers = tempUsers.filter(
                (user) =>
                    user.createdAt &&
                    dhakaDmy(user.createdAt).includes(filters.joining)
            );
        }
        if (filters.partnerType) {
            tempUsers = tempUsers.filter(
                (user) =>
                    user.disability &&
                    user.disability.toLowerCase().includes(filters.partnerType.toLowerCase())
            );
        }
        if (filters.status) {
            tempUsers = tempUsers.filter(
                (user) => user.status && user.status.toLowerCase() === filters.status.toLowerCase()
            );
        }
        if (filters.nid) {
            tempUsers = tempUsers.filter((user) => user.nidVerified === filters.nid);
        }
        if (filters.email) {
            tempUsers = tempUsers.filter((user) => user.emailVerified === filters.email);
        }
        if (filters.phone) {
            tempUsers = tempUsers.filter((user) => user.phoneVerified === filters.phone);
        }

        setFilteredUsers(tempUsers);
        setCurrentPage(1);
    }, [filters, usersList]);

    const totalPages = Math.ceil(filteredUsers.length / usersPerPage);

    const paginateUsers = filteredUsers.slice(
        (currentPage - 1) * usersPerPage,
        currentPage * usersPerPage
    );

    const handlePageChange = (pageNumber: number) => {
        setCurrentPage(Math.min(Math.max(1, pageNumber), Math.max(1, totalPages)));
    };

    const set = (key: keyof typeof EMPTY_FILTERS) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
        setFilters({ ...filters, [key]: e.target.value });
    const filtered = Object.values(filters).some(Boolean);

    const openDetails = (user: UserType) => {
        setSelectedUser(user);
        setShowUserDetailsModal(true);
    };

    return (
        <div className="ui">
            <PageHeader
                eyebrow="People"
                title="Investors & users"
                description="Everyone with an account — investors, partners and admins. Open a name for details and verification."
                actions={
                    <span className="tw-rounded-lg tw-bg-white tw-px-2.5 tw-py-1.5 tw-text-xs tw-font-medium tw-tabular-nums tw-text-slate-600 tw-ring-1 tw-ring-slate-200">
                        {filteredUsers.length.toLocaleString("en-IN")} {filtered ? "matching" : "users"}
                    </span>
                }
            />

            <div className="tw-mb-4 tw-rounded-2xl tw-border tw-border-slate-200 tw-bg-white tw-p-4 tw-shadow-card">
                <div className="tw-grid tw-grid-cols-1 tw-gap-3 sm:tw-grid-cols-2 lg:tw-grid-cols-4">
                    <Field label="Name">
                        <SearchInput placeholder="Search by name" value={filters.name} onChange={set("name")} />
                    </Field>
                    <Field label="Phone or email">
                        <SearchInput placeholder="Search by phone or email" value={filters.phoneEmail} onChange={set("phoneEmail")} />
                    </Field>
                    <Field label="User type">
                        <Select value={filters.userType} onChange={set("userType")}>
                            <option value="">All</option>
                            <option value="admin">Admin</option>
                            <option value="investor">Investor</option>
                            <option value="partner">Partner</option>
                        </Select>
                    </Field>
                    <Field label="Status">
                        <Select value={filters.status} onChange={set("status")}>
                            <option value="">All</option>
                            <option value="active">Active</option>
                            <option value="inactive">Inactive</option>
                            <option value="deleted">Deleted</option>
                        </Select>
                    </Field>
                    <Field label="Age">
                        <Input type="text" inputMode="numeric" placeholder="e.g. 32" value={filters.age} onChange={set("age")} />
                    </Field>
                    <Field label="Joining date" hint="d/m/yyyy, or part of it">
                        <Input type="text" placeholder="e.g. 12/8/2026" value={filters.joining} onChange={set("joining")} />
                    </Field>
                    <div className="tw-grid tw-grid-cols-3 tw-gap-3 lg:tw-col-span-2">
                        <Field label="NID">
                            <Select value={filters.nid} onChange={set("nid")}>
                                <option value="">All</option>
                                <option value="yes">Verified</option>
                                <option value="no">Not verified</option>
                            </Select>
                        </Field>
                        <Field label="Email">
                            <Select value={filters.email} onChange={set("email")}>
                                <option value="">All</option>
                                <option value="yes">Verified</option>
                                <option value="no">Not verified</option>
                            </Select>
                        </Field>
                        <Field label="Phone">
                            <Select value={filters.phone} onChange={set("phone")}>
                                <option value="">All</option>
                                <option value="yes">Verified</option>
                                <option value="no">Not verified</option>
                            </Select>
                        </Field>
                    </div>
                </div>
                {filtered && (
                    <div className="tw-mt-3 tw-flex tw-justify-end">
                        <Button size="sm" variant="ghost" onClick={() => setFilters(EMPTY_FILTERS)}>
                            <RotateCcw className="tw-h-3.5 tw-w-3.5" aria-hidden /> Clear filters
                        </Button>
                    </div>
                )}
            </div>

            <TableCard
                footer={
                    <Pager
                        page={currentPage}
                        totalPages={totalPages}
                        onChange={handlePageChange}
                        summary={
                            filteredUsers.length
                                ? `Showing ${(currentPage - 1) * usersPerPage + 1}–${Math.min(currentPage * usersPerPage, filteredUsers.length)} of ${filteredUsers.length.toLocaleString("en-IN")}`
                                : "No users"
                        }
                    />
                }
            >
                <thead>
                    <tr>
                        <th className={cx(TH, "tw-w-16")}>#</th>
                        <th className={TH}>User</th>
                        <th className={TH}>Contact</th>
                        <th className={TH}>Age</th>
                        <th className={TH}>Joined</th>
                        <th className={TH}>Disability</th>
                        <th className={TH}>Status</th>
                        <th className={TH}>Verified</th>
                        <th className={TH}>Bank</th>
                    </tr>
                </thead>
                <tbody>
                    {paginateUsers.length > 0 ? (
                        paginateUsers.map((user, index) => (
                            <tr key={index} className={TR}>
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
                                    {user.UserBanks && user.UserBanks.length > 0 ? (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setBankModalUser(user);
                                                setShowBankModal(true);
                                            }}
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
                        </div>
                    </Modal.Body>
                </Modal>
            )}
            {bankModalUser && bankModalUser.UserBanks && (
                <Modal size="lg" show={showBankModal} onHide={() => setShowBankModal(false)}>
                    <Modal.Header closeButton>
                        <Modal.Title>Bank information — {bankModalUser.fullName}</Modal.Title>
                    </Modal.Header>
                    <Modal.Body>
                        <div className="ui tw-space-y-3">
                            {bankModalUser.UserBanks.map((ub, i) => (
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
                            ))}
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
    // embedded in the served HTML — so without this guard the whole user table
    // (email, phone, NID, bank accounts) was readable by an anonymous request.
    if (!requireAdminPage(context)) return redirectToLogin;

    const users = await User.findAll({
        // Everything the page shows, minus the password hash: it is never
        // displayed, and every row's hash was being serialised into the HTML.
        attributes: { exclude: ['password'] },
        order: [['idUsers', 'DESC']],
        include: [
            {
                model: UserBank,
                include: [
                    { model: Bank },
                    { model: BankBranch },
                ],
            },
        ],
    });
    return {
        props: {
            users: JSON.parse(JSON.stringify(users)),
        },
    };
}
