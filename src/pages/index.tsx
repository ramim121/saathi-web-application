import { NextPage } from 'next'
import { useState, useEffect } from 'react';
import MainLayout from '@/layouts/MainLayout';
import notification from '@/notifications';
import { Container, Row, Col, Card, Table, Spinner, Alert, Modal, Badge } from 'react-bootstrap';
import { getRequestOptions } from '@/utils/Fetch';
import Link from 'next/link';

/* ─── Types ─────────────────────────────────────────────────────────────── */

interface PayableWindow {
    count: number;
    profitOnly: number;
    profitPlusCapital: number;
}

interface PayableDetail {
    investorName: string;
    projectName: string;
    units: number;
    capital: number;
    estimatedProfit: number;
    profitConfirmed: boolean;
    estimatedTotal: number;
    maturityDate: string;
    investmentDate: string;
    bookingId: number;
}

interface ActiveInvestmentDetail {
    investorName: string;
    projectName: string;
    investmentType: string;
    units: number;
    capital: number;
    status: string;
    profit: number;
    profitPercent: number | null;
    investmentDate: string;
    maturityDate: string;
    bookingId: number;
    reinvestedAmount: number;
}

interface WithdrawalQueueDetail {
    investorName: string;
    projectName: string;
    capital: number;
    profit: number;
    profitPercent: number | null;
    totalPayable: number;
    bookingId: number;
    maturityDate: string;
}

interface PendingPaymentDetail {
    bookingId: number;
    bookingRef: string;
    investorName: string;
    amount: number;
    status: string;
    paymentMethod: string;
    createdAt: string;
}

interface InvestorDetail {
    investorName: string;
    phone: string;
    investmentCount: number;
    totalCapital: number;
    pendingWithdrawal: number;
    projects: string;
}

interface DashboardData {
    totalInvestment: number;
    totalFreshCapital: number;
    totalReinvestedCapital: number;
    withdrawalQueue: number;
    withdrawalQueueCount: number;
    pendingPaymentConfirmations: number;
    pendingCollections: number;
    totalInvestors: number;
    newInvestorsThisMonth: number;
    maturedNeedingAction: number;
    investmentByProject: { projectName: string; investmentType: string; investorCount: number; totalUnits: number; totalRaised: number }[];
    investmentByType: { investmentType: string; totalRaised: number; investorCount: number }[];
    payables: { d15: PayableWindow; d30: PayableWindow; m2: PayableWindow; m3: PayableWindow };
    payableDetails: { d15: PayableDetail[]; d30: PayableDetail[]; m2: PayableDetail[]; m3: PayableDetail[] };
    monthlyTrend: { month: string; newInvestments: number; totalRaised: number }[];
    topPartners: { partnerName: string; investmentCount: number; totalInvested: number }[];
    activeInvestmentDetails: ActiveInvestmentDetail[];
    withdrawalQueueDetails: WithdrawalQueueDetail[];
    pendingPaymentDetails: PendingPaymentDetail[];
    investorDetails: InvestorDetail[];
}

/* ─── Helpers ───────────────────────────────────────────────────────────── */

function fmt(n: number): string {
    return 'BDT ' + Number(n).toLocaleString('en-BD', { maximumFractionDigits: 0 });
}

function fmtDate(d: string): string {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function isMatured(dateStr: string) {
    return dateStr && new Date(dateStr) <= new Date();
}

type DetailModal = 'investment' | 'withdrawal' | 'pending' | 'investors' | null;
type PayableKey = 'd15' | 'd30' | 'm2' | 'm3';

const PAYABLE_LABELS: Record<PayableKey, string> = { d15: '15 days', d30: '30 days', m2: '2 months', m3: '3 months' };

/* ─── Shared table wrapper: scrollable on all screen sizes ──────────────── */
const ScrollTable = ({ children }: { children: React.ReactNode }) => (
    <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <Table bordered hover size="sm" className="mb-0" style={{ minWidth: 400 }}>
            {children}
        </Table>
    </div>
);

/* ─── Page ──────────────────────────────────────────────────────────────── */

interface HomeProps { getLayout(page: React.ReactNode): React.ReactNode }

export default function Home(HomeProps: NextPage) {
    const [data, setData] = useState<DashboardData | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string>('');
    const [openModal, setOpenModal] = useState<DetailModal>(null);
    const [payableWindow, setPayableWindow] = useState<PayableKey | null>(null);
    const [investSearch, setInvestSearch] = useState('');
    const [investSortCol, setInvestSortCol] = useState<'maturityDate' | 'investmentDate' | 'capital' | 'investorName' | 'projectName'>('maturityDate');
    const [investSortDir, setInvestSortDir] = useState<'asc' | 'desc'>('asc');

    useEffect(() => {
        (async () => {
            try {
                const res = await fetch('/api/mis/dashboard', getRequestOptions());
                const json = await res.json();
                if (res.status === 200) setData(json.data);
                else setError(json.message || 'Failed to load dashboard');
            } catch (err: any) {
                setError(err.message || 'Failed to load dashboard');
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    const toggleInvestSort = (col: typeof investSortCol) => {
        if (investSortCol === col) setInvestSortDir(d => d === 'asc' ? 'desc' : 'asc');
        else { setInvestSortCol(col); setInvestSortDir('asc'); }
    };
    const sortArrow = (col: typeof investSortCol) =>
        investSortCol === col ? (investSortDir === 'asc' ? ' ▲' : ' ▼') : ' ⇅';

    if (loading) return (
        <Container fluid className="text-center mt-5">
            <Spinner animation="border" /><p className="mt-2">Loading dashboard…</p>
        </Container>
    );
    if (error) return <Container fluid className="mt-4"><Alert variant="danger">{error}</Alert></Container>;
    if (!data) return null;

    const openPayable = (key: PayableKey) => { setPayableWindow(key); };
    const closePayable = () => setPayableWindow(null);

    return (
        <Container fluid className="mt-3">
            <h4 className="mb-3">Management Dashboard</h4>
            <hr />

            {data.maturedNeedingAction > 0 && (
                <Alert variant="warning" className="mb-3">
                    <strong>Action Required:</strong> {data.maturedNeedingAction} confirmed investment{data.maturedNeedingAction > 1 ? 's have' : ' has'} passed maturity — open each booking and click <em>Ready For Withdrawal</em> to process.
                </Alert>
            )}

            {/* ── Row 1: KPI Cards ─────────────────────────────────────── */}
            <Row className="g-2 g-md-3 mb-4">
                {/* Total Active Investment */}
                <Col xs={12} sm={6} xl>
                    <Card className="h-100 border-primary" style={{ cursor: 'pointer' }} onClick={() => setOpenModal('investment')}>
                        <Card.Body className="p-3">
                            <div className="text-muted small mb-1">Total Active Investment <span className="text-primary">▼</span></div>
                            <div className="text-primary fw-bold fs-6">{fmt(data.totalInvestment)}</div>
                            <div className="text-muted" style={{ fontSize: '0.75rem' }}>{data.activeInvestmentDetails.length} confirmed positions</div>
                        </Card.Body>
                    </Card>
                </Col>
                {/* Fresh Capital */}
                <Col xs={12} sm={6} xl>
                    <Card className="h-100 border-success" style={{ cursor: 'pointer' }} onClick={() => setOpenModal('investment')}>
                        <Card.Body className="p-3">
                            <div className="text-muted small mb-1">Fresh Capital Injected <span className="text-success">▼</span></div>
                            <div className="text-success fw-bold fs-6">{fmt(data.totalFreshCapital)}</div>
                            {data.totalReinvestedCapital > 0 && (
                                <div className="text-muted" style={{ fontSize: '0.75rem' }}>Rolled over: {fmt(data.totalReinvestedCapital)}</div>
                            )}
                        </Card.Body>
                    </Card>
                </Col>
                {/* Withdrawal Queue */}
                <Col xs={12} sm={6} xl>
                    <Card className="h-100 border-warning" style={{ cursor: 'pointer' }} onClick={() => setOpenModal('withdrawal')}>
                        <Card.Body className="p-3">
                            <div className="text-muted small mb-1">Withdrawal Queue <span className="text-warning">▼</span></div>
                            <div className="text-warning fw-bold fs-6">{fmt(data.withdrawalQueue)}</div>
                            <div className="text-muted" style={{ fontSize: '0.75rem' }}>{data.withdrawalQueueCount} pending in system</div>
                        </Card.Body>
                    </Card>
                </Col>
                {/* Pending Payments */}
                <Col xs={12} sm={6} xl>
                    <Card className="h-100 border-danger" style={{ cursor: 'pointer' }} onClick={() => setOpenModal('pending')}>
                        <Card.Body className="p-3">
                            <div className="text-muted small mb-1">Pending Payments <span className="text-danger">▼</span></div>
                            <div className="text-danger fw-bold fs-6">{data.pendingPaymentConfirmations}</div>
                            <div className="text-muted" style={{ fontSize: '0.75rem' }}>bookings awaiting confirmation</div>
                        </Card.Body>
                    </Card>
                </Col>
                {/* Total Investors */}
                <Col xs={12} sm={6} xl>
                    <Card className="h-100 border-info" style={{ cursor: 'pointer' }} onClick={() => setOpenModal('investors')}>
                        <Card.Body className="p-3">
                            <div className="text-muted small mb-1">Active Investors <span className="text-info">▼</span></div>
                            <div className="text-info fw-bold fs-6">{data.totalInvestors}</div>
                            <div className="text-muted" style={{ fontSize: '0.75rem' }}>+{data.newInvestorsThisMonth} joined this month</div>
                        </Card.Body>
                    </Card>
                </Col>
            </Row>

            {/* ── Row 2: Payables Forecast (clickable rows) ────────────── */}
            <Row className="mb-4">
                <Col xs={12}>
                    <h5 className="mb-2">Payables Forecast <small className="text-muted fs-6">(click row for breakdown)</small></h5>
                    <ScrollTable>
                        <thead className="table-dark">
                            <tr>
                                <th>Window</th>
                                <th>Count</th>
                                <th>Profit Only</th>
                                <th>Profit + Capital</th>
                            </tr>
                        </thead>
                        <tbody>
                            {([
                                { key: 'd15' as PayableKey, label: '15 days', w: data.payables.d15 },
                                { key: 'd30' as PayableKey, label: '30 days', w: data.payables.d30 },
                                { key: 'm2'  as PayableKey, label: '2 months', w: data.payables.m2 },
                                { key: 'm3'  as PayableKey, label: '3 months', w: data.payables.m3 },
                            ]).map(({ key, label, w }) => (
                                <tr key={key} style={{ cursor: w.count > 0 ? 'pointer' : 'default' }}
                                    className={w.count > 0 ? 'table-hover' : ''}
                                    onClick={() => w.count > 0 && openPayable(key)}>
                                    <td>
                                        {label}
                                        {w.count > 0 && <span className="text-primary ms-1" style={{ fontSize: '0.7rem' }}>▼</span>}
                                    </td>
                                    <td>{w.count}</td>
                                    <td>{fmt(w.profitOnly)}</td>
                                    <td className="fw-bold">{fmt(w.profitPlusCapital)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </ScrollTable>
                </Col>
            </Row>

            {/* ── Row 3: By Project + Monthly Trend ────────────────────── */}
            <Row className="mb-4 g-3">
                <Col xs={12} lg={7}>
                    <h5 className="mb-2">Investment by Project</h5>
                    <ScrollTable>
                        <thead className="table-dark">
                            <tr>
                                <th>Project</th>
                                <th>Type</th>
                                <th>Investors</th>
                                <th>Units</th>
                                <th>Total Raised</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.investmentByProject.length > 0 ? data.investmentByProject.map((p, i) => (
                                <tr key={i}>
                                    <td>{p.projectName}</td>
                                    <td className="text-nowrap">{p.investmentType === 'sustainable_return' ? 'Sustainable' : 'Fast Return'}</td>
                                    <td>{p.investorCount}</td>
                                    <td>{p.totalUnits}</td>
                                    <td>{fmt(p.totalRaised)}</td>
                                </tr>
                            )) : <tr><td colSpan={5} className="text-center">No data</td></tr>}
                        </tbody>
                    </ScrollTable>
                </Col>
                <Col xs={12} lg={5}>
                    <h5 className="mb-2">Monthly Trend (last 6 months)</h5>
                    <ScrollTable>
                        <thead className="table-dark">
                            <tr><th>Month</th><th>Investments</th><th>Total Raised</th></tr>
                        </thead>
                        <tbody>
                            {data.monthlyTrend.length > 0 ? data.monthlyTrend.map((m, i) => (
                                <tr key={i}>
                                    <td>{m.month}</td>
                                    <td>{m.newInvestments}</td>
                                    <td>{fmt(m.totalRaised)}</td>
                                </tr>
                            )) : <tr><td colSpan={3} className="text-center">No data</td></tr>}
                        </tbody>
                    </ScrollTable>
                </Col>
            </Row>

            {/* ── Row 4: By Type + Top Partners ────────────────────────── */}
            <Row className="mb-4 g-3">
                <Col xs={12} md={4}>
                    <h5 className="mb-2">Investment by Type</h5>
                    <ScrollTable>
                        <thead className="table-dark">
                            <tr><th>Type</th><th>Investors</th><th>Total Raised</th></tr>
                        </thead>
                        <tbody>
                            {data.investmentByType.length > 0 ? data.investmentByType.map((t, i) => (
                                <tr key={i}>
                                    <td>{t.investmentType === 'sustainable_return' ? 'Sustainable Return' : 'Fast Return'}</td>
                                    <td>{t.investorCount}</td>
                                    <td>{fmt(t.totalRaised)}</td>
                                </tr>
                            )) : <tr><td colSpan={3} className="text-center">No data</td></tr>}
                        </tbody>
                    </ScrollTable>
                </Col>
                <Col xs={12} md={8}>
                    <h5 className="mb-2">Top Partners</h5>
                    <ScrollTable>
                        <thead className="table-dark">
                            <tr><th>#</th><th>Partner Name</th><th>Investments</th><th>Total Managed</th></tr>
                        </thead>
                        <tbody>
                            {data.topPartners.length > 0 ? data.topPartners.map((p, i) => (
                                <tr key={i}>
                                    <td>{i + 1}</td>
                                    <td>{p.partnerName}</td>
                                    <td>{p.investmentCount}</td>
                                    <td>{fmt(p.totalInvested)}</td>
                                </tr>
                            )) : <tr><td colSpan={4} className="text-center">No data</td></tr>}
                        </tbody>
                    </ScrollTable>
                </Col>
            </Row>

            {/* ═══════════════════════════════════════════════════════════
                Detail Modals
            ═══════════════════════════════════════════════════════════ */}

            {/* ── Payables Breakdown ─────────────────────────────────── */}
            <Modal show={payableWindow !== null} onHide={closePayable} size="xl" scrollable>
                <Modal.Header closeButton>
                    <Modal.Title>
                        Payables Due — {payableWindow ? PAYABLE_LABELS[payableWindow] : ''}
                        {payableWindow && (
                            <Badge bg="primary" className="ms-2">
                                {data.payables[payableWindow].count} investment{data.payables[payableWindow].count !== 1 ? 's' : ''}
                            </Badge>
                        )}
                        {payableWindow && (
                            <span className="ms-3 fs-6 fw-normal text-muted">
                                {fmt(data.payables[payableWindow].profitPlusCapital)} total payable
                            </span>
                        )}
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    {payableWindow && (
                        <div style={{ overflowX: 'auto' }}>
                            <Table bordered hover size="sm" style={{ minWidth: 700 }}>
                                <thead className="table-dark">
                                    <tr>
                                        <th>#</th>
                                        <th>Investor</th>
                                        <th>Project</th>
                                        <th>Units</th>
                                        <th>Capital</th>
                                        <th>Est. Profit</th>
                                        <th>Total Payable</th>
                                        <th>Maturity Date</th>
                                        <th>Booking</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.payableDetails[payableWindow].length > 0
                                        ? data.payableDetails[payableWindow].map((r, i) => {
                                            const overdue = isMatured(r.maturityDate);
                                            return (
                                                <tr key={i} className={overdue ? 'table-warning' : ''}>
                                                    <td>{i + 1}</td>
                                                    <td>{r.investorName}</td>
                                                    <td>{r.projectName}</td>
                                                    <td>{r.units}</td>
                                                    <td>{fmt(r.capital)}</td>
                                                    <td>
                                                        {fmt(r.estimatedProfit)}
                                                        {!r.profitConfirmed && <small className="text-muted"> (est.)</small>}
                                                    </td>
                                                    <td className="fw-bold">{fmt(r.estimatedTotal)}</td>
                                                    <td className={overdue ? 'text-danger fw-bold' : ''}>
                                                        {fmtDate(r.maturityDate)}
                                                        {overdue && <><br /><small>⚠ Overdue</small></>}
                                                    </td>
                                                    <td>
                                                        <Link href={`/bookings/details/${r.bookingId}`} target="_blank">
                                                            #{r.bookingId}
                                                        </Link>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                        : <tr><td colSpan={9} className="text-center">No investments due in this window</td></tr>
                                    }
                                </tbody>
                                {data.payableDetails[payableWindow].length > 0 && (
                                    <tfoot className="table-secondary fw-bold">
                                        <tr>
                                            <td colSpan={4}>Total</td>
                                            <td>{fmt(data.payableDetails[payableWindow].reduce((s, r) => s + Number(r.capital), 0))}</td>
                                            <td>{fmt(data.payableDetails[payableWindow].reduce((s, r) => s + Number(r.estimatedProfit), 0))}</td>
                                            <td>{fmt(data.payableDetails[payableWindow].reduce((s, r) => s + Number(r.estimatedTotal), 0))}</td>
                                            <td colSpan={2}></td>
                                        </tr>
                                    </tfoot>
                                )}
                            </Table>
                        </div>
                    )}
                </Modal.Body>
            </Modal>

            {/* ── Active Investments ─────────────────────────────────── */}
            <Modal show={openModal === 'investment'} onHide={() => setOpenModal(null)} size="xl" scrollable>
                <Modal.Header closeButton>
                    <Modal.Title>
                        Active Investment Positions
                        <Badge bg="primary" className="ms-2">{data.activeInvestmentDetails.length}</Badge>
                        <span className="ms-3 fs-6 fw-normal text-muted">{fmt(data.totalInvestment)}</span>
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    {/* Search bar */}
                    <div className="mb-2">
                        <input
                            type="text"
                            className="form-control form-control-sm"
                            placeholder="Search by investor or project name…"
                            value={investSearch}
                            onChange={e => setInvestSearch(e.target.value)}
                        />
                    </div>
                    {(() => {
                        const q = investSearch.toLowerCase();
                        const filtered = data.activeInvestmentDetails.filter(r =>
                            !q || r.investorName.toLowerCase().includes(q) || r.projectName.toLowerCase().includes(q)
                        );
                        const sorted = [...filtered].sort((a, b) => {
                            let cmp = 0;
                            if (investSortCol === 'maturityDate' || investSortCol === 'investmentDate') {
                                cmp = new Date(a[investSortCol] || 0).getTime() - new Date(b[investSortCol] || 0).getTime();
                            } else if (investSortCol === 'capital') {
                                cmp = Number(a.capital) - Number(b.capital);
                            } else if (investSortCol === 'investorName') {
                                cmp = a.investorName.localeCompare(b.investorName);
                            } else if (investSortCol === 'projectName') {
                                cmp = a.projectName.localeCompare(b.projectName);
                            }
                            return investSortDir === 'asc' ? cmp : -cmp;
                        });
                        const thStyle: React.CSSProperties = { cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' };
                        return (
                            <div style={{ overflowX: 'auto' }}>
                                <Table bordered hover size="sm" style={{ minWidth: 900 }}>
                                    <thead className="table-dark">
                                        <tr>
                                            <th>#</th>
                                            <th style={thStyle} onClick={() => toggleInvestSort('investorName')}>Investor{sortArrow('investorName')}</th>
                                            <th style={thStyle} onClick={() => toggleInvestSort('projectName')}>Project{sortArrow('projectName')}</th>
                                            <th>Units</th>
                                            <th style={thStyle} onClick={() => toggleInvestSort('capital')}>Capital{sortArrow('capital')}</th>
                                            <th>Fresh / Rollover</th>
                                            <th>Profit (confirmed)</th>
                                            <th style={thStyle} onClick={() => toggleInvestSort('investmentDate')}>Inv. Date{sortArrow('investmentDate')}</th>
                                            <th style={thStyle} onClick={() => toggleInvestSort('maturityDate')}>Maturity Date{sortArrow('maturityDate')}</th>
                                            <th>Booking</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {sorted.length > 0 ? sorted.map((r, i) => {
                                            const fresh = Number(r.capital) - Number(r.reinvestedAmount);
                                            const matured = isMatured(r.maturityDate);
                                            return (
                                                <tr key={i} className={matured ? 'table-warning' : ''}>
                                                    <td>{i + 1}</td>
                                                    <td>{r.investorName}</td>
                                                    <td>
                                                        {r.projectName}
                                                        <br />
                                                        <small className="text-muted">{r.investmentType === 'sustainable_return' ? 'Sustainable' : 'Fast Return'}</small>
                                                    </td>
                                                    <td>{r.units}</td>
                                                    <td>{fmt(r.capital)}</td>
                                                    <td>
                                                        {Number(r.reinvestedAmount) > 0
                                                            ? <><span className="text-success">{fmt(fresh)}</span><br /><small className="text-secondary">+{fmt(r.reinvestedAmount)} rollover</small></>
                                                            : <span className="text-success">{fmt(fresh)}</span>
                                                        }
                                                    </td>
                                                    <td>
                                                        {r.profit > 0
                                                            ? <>{fmt(r.profit)}{r.profitPercent != null ? <small className="text-muted"> ({r.profitPercent}%)</small> : null}</>
                                                            : <span className="text-muted">—</span>
                                                        }
                                                    </td>
                                                    <td className="text-nowrap">{fmtDate(r.investmentDate)}</td>
                                                    <td className={matured ? 'text-danger fw-bold text-nowrap' : 'text-nowrap'}>
                                                        {fmtDate(r.maturityDate)}
                                                        {matured && <><br /><small>⚠ Matured</small></>}
                                                    </td>
                                                    <td>
                                                        <Link href={`/bookings/details/${r.bookingId}`} target="_blank">#{r.bookingId}</Link>
                                                    </td>
                                                </tr>
                                            );
                                        }) : <tr><td colSpan={10} className="text-center text-muted">No matching investments</td></tr>}
                                    </tbody>
                                    {sorted.length > 0 && (
                                        <tfoot className="table-secondary fw-bold">
                                            <tr>
                                                <td colSpan={4}>Total ({sorted.length})</td>
                                                <td>{fmt(sorted.reduce((s, r) => s + Number(r.capital), 0))}</td>
                                                <td>{fmt(sorted.reduce((s, r) => s + Number(r.capital) - Number(r.reinvestedAmount), 0))}</td>
                                                <td>{fmt(sorted.reduce((s, r) => s + Number(r.profit), 0))}</td>
                                                <td colSpan={3}></td>
                                            </tr>
                                        </tfoot>
                                    )}
                                </Table>
                            </div>
                        );
                    })()}
                </Modal.Body>
            </Modal>

            {/* ── Withdrawal Queue ───────────────────────────────────── */}
            <Modal show={openModal === 'withdrawal'} onHide={() => setOpenModal(null)} size="xl" scrollable>
                <Modal.Header closeButton>
                    <Modal.Title>
                        Withdrawal Queue
                        <Badge bg="warning" text="dark" className="ms-2">{data.withdrawalQueueDetails.length} pending</Badge>
                        <span className="ms-3 fs-6 fw-normal text-muted">{fmt(data.withdrawalQueue)} payable</span>
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <div style={{ overflowX: 'auto' }}>
                        <Table bordered hover size="sm" style={{ minWidth: 700 }}>
                            <thead className="table-dark">
                                <tr>
                                    <th>#</th>
                                    <th>Investor</th>
                                    <th>Project</th>
                                    <th>Capital</th>
                                    <th>Profit</th>
                                    <th>Total Payable</th>
                                    <th>Maturity Date</th>
                                    <th>Booking</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.withdrawalQueueDetails.length > 0 ? data.withdrawalQueueDetails.map((r, i) => (
                                    <tr key={i}>
                                        <td>{i + 1}</td>
                                        <td>{r.investorName}</td>
                                        <td>{r.projectName}</td>
                                        <td>{fmt(r.capital)}</td>
                                        <td>
                                            {fmt(r.profit)}
                                            {r.profitPercent != null && <small className="text-muted"> ({r.profitPercent}%)</small>}
                                        </td>
                                        <td className="fw-bold">{fmt(r.totalPayable)}</td>
                                        <td className="text-nowrap">{fmtDate(r.maturityDate)}</td>
                                        <td><Link href={`/bookings/details/${r.bookingId}`} target="_blank">#{r.bookingId}</Link></td>
                                    </tr>
                                )) : <tr><td colSpan={8} className="text-center">Queue is empty</td></tr>}
                            </tbody>
                            {data.withdrawalQueueDetails.length > 0 && (
                                <tfoot className="table-secondary fw-bold">
                                    <tr>
                                        <td colSpan={3}>Total</td>
                                        <td>{fmt(data.withdrawalQueueDetails.reduce((s, r) => s + Number(r.capital), 0))}</td>
                                        <td>{fmt(data.withdrawalQueueDetails.reduce((s, r) => s + Number(r.profit), 0))}</td>
                                        <td>{fmt(data.withdrawalQueueDetails.reduce((s, r) => s + Number(r.totalPayable), 0))}</td>
                                        <td colSpan={2}></td>
                                    </tr>
                                </tfoot>
                            )}
                        </Table>
                    </div>
                </Modal.Body>
            </Modal>

            {/* ── Pending Payments ───────────────────────────────────── */}
            <Modal show={openModal === 'pending'} onHide={() => setOpenModal(null)} size="lg" scrollable>
                <Modal.Header closeButton>
                    <Modal.Title>
                        Pending Payment Confirmations
                        <Badge bg="danger" className="ms-2">{data.pendingPaymentDetails.length}</Badge>
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <div style={{ overflowX: 'auto' }}>
                        <Table bordered hover size="sm" style={{ minWidth: 600 }}>
                            <thead className="table-dark">
                                <tr>
                                    <th>#</th>
                                    <th>Booking</th>
                                    <th>Investor</th>
                                    <th>Amount</th>
                                    <th>Method</th>
                                    <th>Status</th>
                                    <th>Submitted</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.pendingPaymentDetails.length > 0 ? data.pendingPaymentDetails.map((r, i) => (
                                    <tr key={i}>
                                        <td>{i + 1}</td>
                                        <td>{r.bookingRef || `#${r.bookingId}`}</td>
                                        <td>{r.investorName}</td>
                                        <td>{fmt(r.amount)}</td>
                                        <td>{r.paymentMethod?.toUpperCase() || '—'}</td>
                                        <td><Badge bg={r.status === 'uploaded' ? 'info' : 'secondary'}>{r.status}</Badge></td>
                                        <td className="text-nowrap">{fmtDate(r.createdAt)}</td>
                                        <td><Link href={`/bookings/details/${r.bookingId}`} target="_blank">Review</Link></td>
                                    </tr>
                                )) : <tr><td colSpan={8} className="text-center">No pending payments</td></tr>}
                            </tbody>
                        </Table>
                    </div>
                </Modal.Body>
            </Modal>

            {/* ── Investors ──────────────────────────────────────────── */}
            <Modal show={openModal === 'investors'} onHide={() => setOpenModal(null)} size="xl" scrollable>
                <Modal.Header closeButton>
                    <Modal.Title>
                        Active Investors
                        <Badge bg="info" className="ms-2">{data.investorDetails.length} distinct</Badge>
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <div style={{ overflowX: 'auto' }}>
                        <Table bordered hover size="sm" style={{ minWidth: 700 }}>
                            <thead className="table-dark">
                                <tr>
                                    <th>#</th>
                                    <th>Investor</th>
                                    <th>Phone</th>
                                    <th>Positions</th>
                                    <th>Total Capital</th>
                                    <th>Withdrawal Pending</th>
                                    <th>Projects</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.investorDetails.length > 0 ? data.investorDetails.map((r, i) => (
                                    <tr key={i}>
                                        <td>{i + 1}</td>
                                        <td>{r.investorName}</td>
                                        <td className="text-nowrap">{r.phone}</td>
                                        <td>{r.investmentCount}</td>
                                        <td className="fw-bold">{fmt(r.totalCapital)}</td>
                                        <td>
                                            {r.pendingWithdrawal > 0
                                                ? <Badge bg="warning" text="dark">{r.pendingWithdrawal} ready</Badge>
                                                : <span className="text-muted">—</span>
                                            }
                                        </td>
                                        <td><small>{r.projects}</small></td>
                                    </tr>
                                )) : <tr><td colSpan={7} className="text-center">No investors</td></tr>}
                            </tbody>
                            {data.investorDetails.length > 0 && (
                                <tfoot className="table-secondary fw-bold">
                                    <tr>
                                        <td colSpan={4}>Total</td>
                                        <td>{fmt(data.investorDetails.reduce((s, r) => s + Number(r.totalCapital), 0))}</td>
                                        <td colSpan={2}></td>
                                    </tr>
                                </tfoot>
                            )}
                        </Table>
                    </div>
                </Modal.Body>
            </Modal>
        </Container>
    );
}

export async function getServerSideProps() {
    notification();
    return { props: {} };
}

Home.getLayout = function getLayout(page: React.ReactNode) {
    return <MainLayout>{page}</MainLayout>;
}
