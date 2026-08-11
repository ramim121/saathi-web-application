import React, { useMemo, useState } from "react";
import { Container, Row, Col, Table, Form, Badge, Nav } from "react-bootstrap";
import { GetServerSidePropsContext } from "next";
import MainLayout from "@/layouts/MainLayout";
import { requireAdminPage, redirectToLogin } from "@/utils/pageAuth";
import { API_MAP, FEATURE_MATRIX, type ApiEntry, type Consumer, type FeatureRow } from "@/config/apiMap";

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

const KIND_LABEL: Record<ApiEntry["kind"], { text: string; bg: string }> = {
    shared: { text: "Shared", bg: "primary" },
    "admin-only": { text: "Admin only", bg: "secondary" },
    "new-v2": { text: "New (v2)", bg: "success" },
    legacy: { text: "Legacy — retire", bg: "danger" },
};

const AUTH_LABEL: Record<ApiEntry["auth"], { text: string; bg: string }> = {
    public: { text: "Public", bg: "warning" },
    user: { text: "User", bg: "info" },
    admin: { text: "Admin", bg: "dark" },
};

const CONSUMER_LABEL: Record<Consumer, string> = {
    app: "📱 App",
    web: "🌐 Web",
    admin: "🛠 Admin",
};

function ApiViewer() {
    const [tab, setTab] = useState<"routes" | "features">("routes");
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
        <Container fluid className="py-3">
            <h4>API map</h4>
            <p className="text-muted mb-3" style={{ maxWidth: 760 }}>
                The website was built against this same API rather than a new one. Of the routes the
                website calls, most are the very routes the mobile app calls — so a change to a
                shared route reaches a shipped binary that cannot be patched. Check here first.
            </p>

            <Row className="mb-3">
                <Col><SummaryCard label="Routes documented" value={counts.total} /></Col>
                <Col><SummaryCard label="Used by app + web" value={counts.shared} /></Col>
                <Col><SummaryCard label="New for the website" value={counts.newV2} /></Col>
                <Col><SummaryCard label="Legacy, to retire" value={counts.legacy} tone="danger" /></Col>
                <Col><SummaryCard label="Unauthenticated" value={counts.publicRoutes} tone="warning" /></Col>
            </Row>

            <Nav variant="tabs" activeKey={tab} onSelect={(k) => setTab((k as "routes" | "features") ?? "routes")} className="mb-3">
                <Nav.Item><Nav.Link eventKey="routes">Routes</Nav.Link></Nav.Item>
                <Nav.Item><Nav.Link eventKey="features">Web vs App by feature</Nav.Link></Nav.Item>
            </Nav>

            {tab === "routes" ? (
                <>
                    <Row className="mb-3 g-2">
                        <Col md={5}>
                            <Form.Control
                                placeholder="Search path, feature or note…"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                            />
                        </Col>
                        <Col md={3}>
                            <Form.Select value={consumer} onChange={(e) => setConsumer(e.target.value as "" | Consumer)}>
                                <option value="">Any consumer</option>
                                <option value="app">📱 App</option>
                                <option value="web">🌐 Website</option>
                                <option value="admin">🛠 Admin panel</option>
                            </Form.Select>
                        </Col>
                        <Col md={3}>
                            <Form.Select value={kind} onChange={(e) => setKind(e.target.value as "" | ApiEntry["kind"])}>
                                <option value="">Any kind</option>
                                <option value="shared">Shared</option>
                                <option value="new-v2">New (v2)</option>
                                <option value="legacy">Legacy — retire</option>
                                <option value="admin-only">Admin only</option>
                            </Form.Select>
                        </Col>
                    </Row>

                    {grouped.length === 0 && <p className="text-muted">Nothing matches that filter.</p>}

                    {grouped.map(([feature, entries]) => (
                        <div key={feature} className="mb-4">
                            <h6 className="text-uppercase text-muted">{feature}</h6>
                            <Table bordered size="sm" responsive className="align-middle">
                                <thead className="table-light">
                                    <tr>
                                        <th style={{ width: "22%" }}>Path</th>
                                        <th style={{ width: "8%" }}>Methods</th>
                                        <th style={{ width: "8%" }}>Auth</th>
                                        <th style={{ width: "12%" }}>Used by</th>
                                        <th style={{ width: "10%" }}>Kind</th>
                                        <th>Notes</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {entries.map((entry: ApiEntry) => (
                                        <tr key={entry.path}>
                                            <td><code>{entry.path}</code></td>
                                            <td>{entry.methods.join(", ")}</td>
                                            <td>
                                                <Badge bg={AUTH_LABEL[entry.auth].bg}>
                                                    {AUTH_LABEL[entry.auth].text}
                                                </Badge>
                                            </td>
                                            <td>
                                                {entry.consumers.map((c: Consumer) => (
                                                    <div key={c} className="small">{CONSUMER_LABEL[c]}</div>
                                                ))}
                                            </td>
                                            <td>
                                                <Badge bg={KIND_LABEL[entry.kind].bg}>
                                                    {KIND_LABEL[entry.kind].text}
                                                </Badge>
                                            </td>
                                            <td className="small">
                                                {entry.webProxy && (
                                                    <div className="text-muted">
                                                        Website proxy: <code>{entry.webProxy}</code>
                                                    </div>
                                                )}
                                                {entry.notes}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </Table>
                        </div>
                    ))}
                </>
            ) : (
                <FeatureTable />
            )}
        </Container>
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

    return (
        <>
            <p className="text-muted small">
                Where both platforms call the same endpoint the two cells are merged — the table is
                for finding the differences, and repeating an identical path twice hides them.
            </p>
            <Table bordered size="sm" responsive className="align-middle">
                <thead className="table-light">
                    <tr>
                        <th style={{ width: "12%" }}>Feature</th>
                        <th style={{ width: "20%" }}>Capability</th>
                        <th style={{ width: "26%" }}>🌐 Website</th>
                        <th style={{ width: "26%" }}>📱 Mobile app</th>
                        <th>Note</th>
                    </tr>
                </thead>
                <tbody>
                    {groups.map(([feature, rows]) =>
                        rows.map((row: FeatureRow, index: number) => (
                            <tr key={feature + row.capability}>
                                {index === 0 && (
                                    <td rowSpan={rows.length} className="fw-semibold align-top">
                                        {feature}
                                    </td>
                                )}
                                <td>{row.capability}</td>
                                {row.shared ? (
                                    <td colSpan={2} className="table-success">
                                        <span className="badge bg-success me-2">Same</span>
                                        <code>{row.shared}</code>
                                    </td>
                                ) : (
                                    <>
                                        <td><code>{row.web}</code></td>
                                        <td><code>{row.app}</code></td>
                                    </>
                                )}
                                <td className="small text-muted">{row.note}</td>
                            </tr>
                        )),
                    )}
                </tbody>
            </Table>
        </>
    );
}

function SummaryCard({ label, value, tone }: { label: string; value: number; tone?: string }) {
    return (
        <div className={`border rounded p-3 h-100 ${tone ? `border-${tone}` : ""}`}>
            <div className={`fs-4 fw-bold ${tone ? `text-${tone}` : ""}`}>{value}</div>
            <div className="text-muted small">{label}</div>
        </div>
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
