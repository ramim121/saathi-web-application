import { useEffect, useRef, type ReactNode } from 'react';
import { Loader2, Pencil, Plus } from 'lucide-react';
import { Card } from '@/ui/primitives';
import { Button } from '@/ui/controls';
import { PageHeader } from '@/ui/layout';

/**
 * The setup pages (skills, units, categories, plans, panels, partnerships,
 * testimonials) share one shape: what exists, on the left; a create or edit
 * form, on the right and sticky. Each page keeps its own state and requests.
 */
export function SetupShell({ title, description, list, form }: { title: string; description: ReactNode; list: ReactNode; form: ReactNode }) {
    return (
        <div className="ui">
            <PageHeader eyebrow="Setup" title={title} description={description} />
            <div className="tw-grid tw-grid-cols-1 tw-items-start tw-gap-6 lg:tw-grid-cols-[minmax(0,1fr)_22rem]">
                <div className="tw-min-w-0">{list}</div>
                {/* Sticky so Edit on a row far down the list still lands in view; capped at
                    the viewport and scrollable so a tall form (testimonials) keeps its
                    submit button reachable. The -m-1/p-1 pair leaves room for the card's shadow. */}
                <div data-setup-form className="lg:tw-sticky lg:tw-top-24 lg:-tw-m-1 lg:tw-max-h-[calc(100vh-7rem)] lg:tw-overflow-y-auto lg:tw-p-1">
                    {form}
                </div>
            </div>
        </div>
    );
}

export function SetupFormCard({
    noun,
    editingId,
    onCancelEdit,
    onSubmit,
    loading,
    children,
}: {
    noun: string;
    /** Set while editing an existing row; the form creates otherwise. */
    editingId?: number | string | null;
    onCancelEdit?: () => void;
    onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
    loading: boolean;
    children: ReactNode;
}) {
    const editing = editingId !== undefined && editingId !== null && editingId !== 0 && editingId !== '';
    const top = useRef<HTMLDivElement>(null);

    // Edit on a row should visibly load the form. On a phone the form sits below
    // the list, and on a desktop its panel may have been scrolled, so bring the
    // form's heading up when it is off screen or in the lower half. The sticky
    // desktop heading sits near the top, so there nothing moves.
    useEffect(() => {
        const el = top.current;
        if (!editing || !el) return;
        const panel = el.closest('[data-setup-form]');
        if (panel) panel.scrollTop = 0;
        const { top: y } = el.getBoundingClientRect();
        if (y < 0 || y > window.innerHeight / 2) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, [editing, editingId]);

    return (
        <Card className="tw-p-5">
            <div ref={top} className="tw-scroll-mt-24" aria-hidden />
            <div className="tw-flex tw-items-start tw-justify-between tw-gap-2">
                <h2 className="tw-text-sm tw-font-semibold tw-text-slate-900">{editing ? `Edit ${noun} #${editingId}` : `New ${noun}`}</h2>
                {editing && onCancelEdit && (
                    <button type="button" onClick={onCancelEdit} className="tw-text-xs tw-font-medium tw-text-slate-500 hover:tw-text-slate-800">
                        Cancel edit
                    </button>
                )}
            </div>
            <form onSubmit={onSubmit} className="tw-mt-4 tw-space-y-4">
                {children}
                <Button variant="primary" type="submit" className="tw-w-full" disabled={loading}>
                    {loading ? <Loader2 className="tw-h-4 tw-w-4 tw-animate-spin" aria-hidden /> : editing ? <Pencil className="tw-h-4 tw-w-4" aria-hidden /> : <Plus className="tw-h-4 tw-w-4" aria-hidden />}
                    {editing ? `Save ${noun}` : `Add ${noun}`}
                </Button>
            </form>
        </Card>
    );
}
