import React, { useMemo, useState } from "react";
import { GetServerSidePropsContext } from "next";
import { Globe, Smartphone, Wrench, type LucideIcon } from "lucide-react";
import MainLayout from "@/layouts/MainLayout";
import { requireAdminPage, redirectToLogin } from "@/utils/pageAuth";
import { API_MAP, FEATURE_MATRIX, type ApiEntry, type Consumer, type FeatureRow } from "@/config/apiMap";
import { Card, Pill, Segmented, cx, type Tone } from "@/ui/primitives";
import { Field, SearchInput, Select } from "@/ui/controls";
import { PageHeader, TableCard, TD, TH, TR } from "@/ui/layout";
import { plural } from "@/ui/format";

/**
 * API viewer — every backend route, who calls it, and how the website and the
 * app differ.
 *
 * Built because the website reuses the app's API rather than duplicating it.
 * That is the right call — one backend, one source of truth — but it means a
 * change to a shared route reaches a shipped mobile binary that cannot be
 * patched. This page is what you check before touching one.
 *
 * Two views:
 *   Routes    every endpoint, filterable, with the traps written down.
 *   Features  web against app, capability by capability. Where both use the
 *             same route the cells are **merged**, so the table shows the
 *             differences instead of burying them in repetition.
 *
 * Admin-gated: it is a complete map of the API surface, including which routes
 * are still unauthenticated.
 */

/**
 * Groups rows by their `feature` field, preserving first-seen order.
 *
 * Written with arrays rather than spreading `Map.entries()` because this
 * project compiles to ES5, where that spread needs --downlevelIteration.
 */
function groupByFeature<T extends { feature: string }>(rows: T[]): Array<[string, T[]]> {
    const order: string[] = [];
    const buckets: Record<string, T[]> = {};
    rows.forEach((row) => {
        if (!buckets[row.feature]) {
            buckets[row.feature] = [];
            order.push(row.feature);
        }
        buckets[row.feature].push(row);
    });
    return order.map((feature) => [feature, buckets[feature]] as [string, T[]]);
}

const KIND_LABEL: Record<ApiEntry["kind"], { text: string; tone: Tone }> = {
    shared: { text: "Shared", tone: "sky" },
    "admin-only": { text: "Admin only", tone: "slate" },
    "new-v2": { text: "New (v2)", tone: "green" },
    legacy: { text: "Legacy — retire", tone: "rose" },
};

const AUTH_LABEL: Record<ApiEntry["auth"], { text: string; tone: Tone }> = {
    public: { text: "Public", tone: "amber" },
    user: { text: "User", tone: "violet" },
    admin: { text: "Admin", tone: "slate" },
};

const CONSUMER_LABEL: Record<Consumer, { text: string; icon: LucideIcon }> = {
    app: { text: "App", icon: Smartphone },
    web: { text: "Web", icon: Globe },
    admin: { text: "Admin", icon: Wrench },
};

type Tab = "routes" | "features";

/** The map's notes mark emphasis with **double asterisks**; show it as bold. */
function Note({ text }: { text?: string }) {
    if (!text) return null;
    return (
        <>
            {text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
                part.startsWith("**") && part.endsWith("**") ? (
                    <strong key={i} className="tw-font-semibold tw-text-slate-800">
                        {part.slice(2, -2)}
                    </strong>
                ) : (
                    <React.Fragment key={i}>{part}</React.Fragment>
                ),
            )}
        </>
    );
}

function ApiViewer() {
    const [tab, setTab] = useState<Tab>("routes");
    const [query, setQuery] = useState("");
    const [consumer, setConsumer] = useState<"" | Consumer>("");
    const [kind, setKind] = useState<"" | ApiEntry["kind"]>("");

    const routes = useMemo(() => {
        const needle = query.trim().toLowerCase();
        return API_MAP.filter((entry) => {
            if (consumer && !entry.consumers.includes(consumer)) return false;
            if (kind && entry.kind !== kind) return false;
            if (!needle) return true;
            return (
                entry.path.toLowerCase().includes(needle) ||
                entry.feature.toLowerCase().includes(needle) ||
                (entry.notes ?? "").toLowerCase().includes(needle)
            );
        });
    }, [query, consumer, kind]);

    const grouped = useMemo(() => groupByFeature(routes), [routes]);

    const counts = useMemo(
        () => ({
            total: API_MAP.length,
            shared: API_MAP.filter((e) => e.consumers.includes("app") && e.consumers.includes("web")).length,
            newV2: API_MAP.filter((e) => e.kind === "new-v2").length,
            legacy: API_MAP.filter((e) => e.kind === "legacy").length,
            publicRoutes: API_MAP.filter((e) => e.auth === "public").length,
        }),
        [],
    );

    return (
        <div className="ui">
            <PageHeader
                eyebrow="Developer"
                title="API map"
                description="The website was built against this same API rather than a new one. Of the routes the website calls, most are the very routes the mobile app calls — so a change to a shared route reaches a shipped binary that cannot be patched. Check here first."
            />

            <div className="tw-mb-6 tw-grid tw-grid-cols-2 tw-gap-3 sm:tw-grid-cols-3 xl:tw-grid-cols-5">
                <SummaryCard label="Routes documented" value={counts.total} />
                <SummaryCard label="Used by app + web" value={counts.shared} />
                <SummaryCard label="New for the website" value={counts.newV2} />
                <SummaryCard label="Legacy, to retire" value={counts.legacy} tone="rose" />
                <SummaryCard label="Unauthenticated" value={counts.publicRoutes} tone="amber" />
            </div>

            <div className="tw-mb-4">
                <Segmented<Tab>
                    label="View"
                    value={tab}
                    onChange={setTab}
                    options={[
                        { value: "routes", label: "Routes", count: API_MAP.length },
                        { value: "features", label: "Web vs app by feature", count: FEATURE_MATRIX.length },
                    ]}
                />
            </div>

            {tab === "routes" ? (
                <>
                    <Card className="tw-mb-4 tw-p-4">
                        <div className="tw-grid tw-gap-3 md:tw-grid-cols-[minmax(0,1fr)_12rem_12rem]">
                            <Field label="Search">
                                <SearchInput placeholder="Path, feature or note…" value={query} onChange={(e) => setQuery(e.target.value)} />
                            </Field>
                            <Field label="Used by">
                                <Select value={consumer} onChange={(e) => setConsumer(e.target.value as "" | Consumer)}>
                                    <option value="">Any consumer</option>
                                    <option value="app">App</option>
                                    <option value="web">Website</option>
                                    <option value="admin">Admin panel</option>
                                </Select>
                            </Field>
                            <Field label="Kind">
                                <Select value={kind} onChange={(e) => setKind(e.target.value as "" | ApiEntry["kind"])}>
                                    <option value="">Any kind</option>
                                    <option value="shared">Shared</option>
                                    <option value="new-v2">New (v2)</option>
                                    <option value="legacy">Legacy — retire</option>
                                    <option value="admin-only">Admin only</option>
                                </Select>
                            </Field>
                        </div>
                        <p className="tw-mt-3 tw-text-xs tw-tabular-nums tw-text-slate-500">
                            {routes.length === API_MAP.length ? plural(routes.length, "route") : `${routes.length} of ${plural(API_MAP.length, "route")}`}
                        </p>
                    </Card>

                    {grouped.length === 0 && <Card className="tw-p-10 tw-text-center tw-text-sm tw-text-slate-500">Nothing matches that filter.</Card>}

                    <div className="tw-space-y-4">
                        {grouped.map(([feature, entries]) => (
                            <TableCard
                                key={feature}
                                toolbar={
                                    <div className="tw-flex tw-items-baseline tw-justify-between tw-gap-3">
                                        <h2 className="tw-text-sm tw-font-semibold tw-text-slate-900">{feature}</h2>
                                        <span className="tw-text-xs tw-tabular-nums tw-text-slate-400">{plural(entries.length, "route")}</span>
                                    </div>
                                }
                            >
                                <thead>
                                    <tr>
                                        <th className={cx(TH, "tw-w-[24%]")}>Path</th>
                                        <th className={TH}>Methods</th>
                                        <th className={TH}>Auth</th>
                                        <th className={TH}>Used by</th>
                                        <th className={TH}>Kind</th>
                                        <th className={TH}>Notes</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {entries.map((entry: ApiEntry) => (
                                        <tr key={entry.path} className={TR}>
                                            <td className={TD}>
                                                <code className="tw-whitespace-nowrap tw-font-mono tw-text-xs tw-text-slate-800">{entry.path}</code>
                                            </td>
                                            <td className={cx(TD, "tw-whitespace-nowrap tw-font-mono tw-text-xs tw-text-slate-500")}>{entry.methods.join(", ")}</td>
                                            <td className={TD}>
                                                <Pill tone={AUTH_LABEL[entry.auth].tone} dot={false}>
                                                    {AUTH_LABEL[entry.auth].text}
                                                </Pill>
                                            </td>
                                            <td className={TD}>
                                                <div className="tw-flex tw-flex-col tw-gap-1">
                                                    {entry.consumers.map((c: Consumer) => {
                                                        const { text, icon: IconCmp } = CONSUMER_LABEL[c];
                                                        return (
                                                            <span key={c} className="tw-inline-flex tw-items-center tw-gap-1.5 tw-whitespace-nowrap tw-text-xs tw-text-slate-600">
                                                                <IconCmp className="tw-h-3.5 tw-w-3.5 tw-text-slate-400" aria-hidden />
                                                                {text}
                                                            </span>
                                                        );
                                                    })}
                                                </div>
                                            </td>
                                            <td className={TD}>
                                                <Pill tone={KIND_LABEL[entry.kind].tone} dot={false}>
                                                    {KIND_LABEL[entry.kind].text}
                                                </Pill>
                                            </td>
                                            <td className={cx(TD, "tw-min-w-[16rem] tw-text-xs tw-leading-5 tw-text-slate-600")}>
                                                {entry.webProxy && (
                                                    <div className="tw-mb-1 tw-text-slate-500">
                                                        Website proxy: <code className="tw-font-mono tw-text-slate-700">{entry.webProxy}</code>
                                                    </div>
                                                )}
                                                <Note text={entry.notes} />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </TableCard>
                        ))}
                    </div>
                </>
            ) : (
                <FeatureTable />
            )}
        </div>
    );
}

/**
 * Web-vs-app table.
 *
 * A row whose `shared` field is set spans both columns — one cell, one route,
 * stated once. Rows where they differ keep two cells, which is where the eye
 * should go.
 */
function FeatureTable() {
    const groups = useMemo(() => groupByFeature(FEATURE_MATRIX), []);
    const code = "tw-font-mono tw-text-xs tw-text-slate-800";

    return (
        <>
            <p className="tw-mb-3 tw-max-w-3xl tw-text-sm tw-text-slate-500">
                Where both platforms call the same endpoint the two cells are merged — the table is for finding the differences, and repeating an identical path twice hides them.
            </p>
            <TableCard>
                <thead>
                    <tr>
                        <th className={cx(TH, "tw-w-[12%]")}>Feature</th>
                        <th className={cx(TH, "tw-w-[20%]")}>Capability</th>
                        <th className={cx(TH, "tw-w-[26%]")}>
                            <span className="tw-inline-flex tw-items-center tw-gap-1.5">
                                <Globe className="tw-h-3.5 tw-w-3.5" aria-hidden /> Website
                            </span>
                        </th>
                        <th className={cx(TH, "tw-w-[26%]")}>
                            <span className="tw-inline-flex tw-items-center tw-gap-1.5">
                                <Smartphone className="tw-h-3.5 tw-w-3.5" aria-hidden /> Mobile app
                            </span>
                        </th>
                        <th className={TH}>Note</th>
                    </tr>
                </thead>
                <tbody>
                    {groups.map(([feature, rows]) =>
                        rows.map((row: FeatureRow, index: number) => (
                            <tr key={feature + row.capability} className={cx("tw-border-t", index === 0 ? "tw-border-slate-200" : "tw-border-slate-100")}>
                                {index === 0 && (
                                    <td rowSpan={rows.length} className={cx(TD, "tw-bg-slate-50/60 tw-font-semibold tw-text-slate-900")}>
                                        {feature}
                                    </td>
                                )}
                                <td className={cx(TD, "tw-min-w-[10rem] tw-text-slate-700")}>{row.capability}</td>
                                {row.shared ? (
                                    <td colSpan={2} className={cx(TD, "tw-bg-emerald-50/70")}>
                                        <span className="tw-mr-2 tw-inline-flex tw-rounded-full tw-bg-emerald-600 tw-px-2 tw-py-0.5 tw-text-[11px] tw-font-semibold tw-text-white">Same</span>
                                        <code className={code}>{row.shared}</code>
                                    </td>
                                ) : (
                                    <>
                                        <td className={TD}>
                                            <code className={code}>{row.web}</code>
                                        </td>
                                        <td className={TD}>
                                            <code className={code}>{row.app}</code>
                                        </td>
                                    </>
                                )}
                                <td className={cx(TD, "tw-min-w-[12rem] tw-text-xs tw-leading-5 tw-text-slate-500")}>
                                    <Note text={row.note} />
                                </td>
                            </tr>
                        )),
                    )}
                </tbody>
            </TableCard>
        </>
    );
}

function SummaryCard({ label, value, tone }: { label: string; value: number; tone?: "rose" | "amber" }) {
    return (
        <Card className={cx("tw-p-4", tone === "rose" && "tw-border-rose-200", tone === "amber" && "tw-border-amber-200")}>
            <div className={cx("tw-text-2xl tw-font-semibold tw-tabular-nums tw-tracking-tight", tone === "rose" ? "tw-text-rose-600" : tone === "amber" ? "tw-text-amber-600" : "tw-text-slate-900")}>{value}</div>
            <div className="tw-mt-0.5 tw-text-xs tw-text-slate-500">{label}</div>
        </Card>
    );
}

export default ApiViewer;

ApiViewer.getLayout = function PageLayout(page: React.ReactNode) {
    return <MainLayout>{page}</MainLayout>;
};

export async function getServerSideProps(context: GetServerSidePropsContext) {
    // The map names every unauthenticated route, so it is admin-gated.
    if (!requireAdminPage(context)) return redirectToLogin;
    return { props: {} };
}
