import { useEffect, useState, type ReactNode } from 'react';
import { Editor } from '@tinymce/tinymce-react';
import { Card } from '@/ui/primitives';
import { bdtExact } from '@/ui/format';
import { returnRange, words } from '@/ui/status';

/**
 * Pieces shared by New project and Edit project. Each page keeps its own
 * state and submit handler; these only render.
 */

export function FormSection({ title, description, children, aside }: { title: string; description?: ReactNode; children: ReactNode; aside?: ReactNode }) {
    return (
        <Card>
            <div className="tw-flex tw-flex-wrap tw-items-start tw-justify-between tw-gap-3 tw-border-b tw-border-slate-100 tw-px-5 tw-py-4">
                <div>
                    <h2 className="tw-text-sm tw-font-semibold tw-text-slate-900">{title}</h2>
                    {description && <p className="tw-mt-0.5 tw-text-xs tw-text-slate-500">{description}</p>}
                </div>
                {aside}
            </div>
            <div className="tw-p-5">{children}</div>
        </Card>
    );
}

export type PlanLike = {
    duration?: number;
    tenure?: string;
    minimumReturn?: number;
    maximumReturn?: number;
    investmentType?: string;
    returnType?: string;
};

/** The investment plan's terms, read-only: they come from the plan, not from this form. */
export function PlanFacts({ plan, totalReturnMin, totalReturnMax }: { plan: PlanLike; totalReturnMin: number; totalReturnMax: number }) {
    const chosen = plan.duration !== undefined || plan.investmentType !== undefined;
    const facts: [string, string][] = [
        ['Investment type', plan.investmentType ? words(plan.investmentType) : '—'],
        ['Return type', plan.returnType ? words(plan.returnType) : '—'],
        ['Return', chosen ? returnRange(plan.minimumReturn ?? 0, plan.maximumReturn ?? 0) : '—'],
        ['Term', chosen && plan.duration !== undefined ? `${plan.duration} ${plan.tenure ?? ''}`.trim() : '—'],
        [
            'Back per unit',
            Number(totalReturnMin) || Number(totalReturnMax) ? `${bdtExact(Number(totalReturnMin))} – ${bdtExact(Number(totalReturnMax))}` : '—',
        ],
    ];
    return (
        <dl className="tw-grid tw-grid-cols-2 tw-gap-px tw-overflow-hidden tw-rounded-xl tw-border tw-border-slate-200 tw-bg-slate-200 sm:tw-grid-cols-5">
            {facts.map(([label, value]) => (
                <div key={label} className="tw-bg-slate-50 tw-px-3 tw-py-2.5">
                    <dt className="tw-text-xs tw-text-slate-500">{label}</dt>
                    <dd className="tw-mt-0.5 tw-text-sm tw-font-semibold tw-tabular-nums tw-text-slate-900">{value}</dd>
                </div>
            ))}
        </dl>
    );
}

/**
 * A picked file that has not been uploaded yet, shown as a thumbnail that
 * opens full size. The object URL is released when the preview goes away.
 */
export function LocalPreview({ file, className }: { file: File; className?: string }) {
    const [url, setUrl] = useState<string | null>(null);
    useEffect(() => {
        const objectUrl = URL.createObjectURL(file);
        setUrl(objectUrl);
        return () => URL.revokeObjectURL(objectUrl);
    }, [file]);
    if (!url) return null;
    return (
        <a href={url} target="_blank" rel="noopener noreferrer" title={file.name} className="tw-block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt={file.name} className={className} />
        </a>
    );
}

const EDITOR_API_KEY ='abqylwi3epqtdz7e4t0aasmr5f62etpkkrrd9kiuktqf004r';
const EDITOR_PLUGINS = [
    'advlist', 'autolink', 'lists', 'link', 'image', 'charmap', 'preview',
    'anchor', 'searchreplace', 'visualblocks', 'code', 'fullscreen',
    'insertdatetime', 'media', 'table', 'help', 'wordcount'
];
const EDITOR_TOOLBAR =
    'undo redo | blocks | ' +
    'bold italic backcolor | alignleft aligncenter ' +
    'alignright alignjustify | bullist numlist outdent indent | ' +
    'removeformat | help';

/**
 * The summary editor (TinyMCE), with the same plugins, toolbar and fonts the
 * old forms used. `bangla` switches to a Bangla-capable font stack.
 *
 * Content that arrives from the server must go in through `initialValue`, not
 * `editor.setContent()`: the React wrapper resets the editor to `initialValue`
 * when it finishes starting, and again whenever `initialValue` changes. Setting
 * content any other way is wiped if the editor starts after the data arrived.
 */
export function SummaryEditor({
    id,
    height,
    bangla = false,
    initialValue,
    onInit,
}: {
    id: string;
    height: number;
    bangla?: boolean;
    initialValue?: string;
    onInit: (editor: any) => void;
}) {
    // TinyMCE draws its own border and rounded frame.
    return (
        <Editor
            apiKey={EDITOR_API_KEY}
            onInit={(evt, editor) => onInit(editor)}
            initialValue={initialValue}
            id={id}
            init={{
                height,
                plugins: EDITOR_PLUGINS,
                toolbar: EDITOR_TOOLBAR,
                content_style: bangla
                    ? 'body { font-family:"Noto Sans Bengali","Nirmala UI",Helvetica,Arial,sans-serif; font-size:16px; line-height:1.7 }'
                    : 'body { font-family:Helvetica,Arial,sans-serif; font-size:16px }',
            }}
        />
    );
}
