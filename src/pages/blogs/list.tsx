import React, { useCallback, useEffect, useMemo, useState } from "react";
import MainLayout from "@/layouts/MainLayout";
import { getRequestOptions, deleteRequestOptions } from "@/utils/Fetch";
import Swal from "sweetalert2";
import { S3_URL } from '@/config/public';
import { API_URL } from '@/config/public';
import { CalendarDays, Newspaper, PenLine, Pencil, Plus, Trash2 } from "lucide-react";
import { Card, SafeImg, Skeleton } from "@/ui/primitives";
import { Button, Field, LinkButton, Select } from "@/ui/controls";
import { PageHeader } from "@/ui/layout";
import { ListFooter, ListToolbar, filterChips, useClientRows, useListState } from "@/ui/table";
import { date } from "@/ui/format";

interface ListProps {
    idBlogs: number,
    heading: string,
    description: string,
    writtenBy: string,
    writtenDate: string,
    featuredImage: string | null
}

/** The post as plain text, for a two-line excerpt. */
function excerpt(html: string | null | undefined): string {
    return (html || '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\s+/g, ' ')
        .trim();
}

// The endpoint returns every post, so the page searches, filters, sorts and
// pages them here. Newest first is the endpoint's own order.
const DEFAULTS = {
    q: '',
    writer: '',
    orderBy: 'idBlogs',
    orderType: 'DESC' as 'ASC' | 'DESC',
    page: 1,
    pageSize: 25,
};

const SORT_OPTIONS = [
    { value: 'idBlogs:DESC', label: 'Newest first' },
    { value: 'idBlogs:ASC', label: 'Oldest first' },
    { value: 'heading:ASC', label: 'Title A–Z' },
];

function List() {
    const [blogsList, setBlogsList] = useState<ListProps[]>([]);
    const [reload, setReload] = useState<boolean>(true);
    const [loaded, setLoaded] = useState<boolean>(false);

    const list = useListState(DEFAULTS);
    const { state, update } = list;
    const writers = useMemo(
        () => Array.from(new Set(blogsList.map((b) => b.writtenBy).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
        [blogsList],
    );
    const byWriter = useCallback((blog: ListProps) => !state.writer || blog.writtenBy === state.writer, [state.writer]);
    const { total, pageRows } = useClientRows(blogsList, state, {
        text: (blog) => `${blog.heading} ${blog.writtenBy ?? ''} ${excerpt(blog.description)}`,
        sort: { idBlogs: (blog) => blog.idBlogs, heading: (blog) => blog.heading },
        filter: byWriter,
    });
    const chips = filterChips(state, list.defaults, { writer: 'Written by' }, update);

    // A delete can empty the last page: go to the new last page.
    useEffect(() => {
        if (!loaded || !list.ready) return;
        const last = Math.max(1, Math.ceil(total / state.pageSize));
        if (state.page > last) update({ page: last });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loaded, list.ready, total, state.page, state.pageSize]);

    useEffect(() => {
        const fetchBlogsList = async () => {
            try {
                const res = await fetch('/api/blogs/list', getRequestOptions());
                const data = await res.json();
                if (res.status === 200) {
                    setBlogsList(data.data);
                    setReload(false);
                } else {
                    Swal.fire({
                        icon: 'error',
                        title: 'Error',
                        text: data.message,
                    });
                }
            } catch (err: any) {
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: err.message,
                });
            } finally {
                setLoaded(true);
            }
        }
        fetchBlogsList();
    }, [reload]);

    const handleDelete = async (id: number) => {
        Swal.fire({
            title: 'Are you sure?',
            text: "You want to delete this blog!",
            icon: 'warning',
            showCancelButton: true,
            cancelButtonText: 'No',
            confirmButtonText: 'Yes'
        }).then(async (result) => {
            if (result.value) {
                try {
                    const res = await fetch(API_URL + 'api/blogs/delete/' + id, deleteRequestOptions());

                    if (res.status === 200) {
                        Swal.fire({
                            icon: 'success',
                            title: 'Success',
                            text: 'Blog deleted successfully!',
                        });
                        setReload(true);
                    } else {
                        Swal.fire({
                            icon: 'error',
                            title: 'Error',
                            html: (await res.json()).message,
                        });
                    }
                } catch (err) {
                    Swal.fire({
                        icon: 'error',
                        title: 'Error',
                        text: 'Something went wrong!',
                    });
                }
            }
        });
    }

    return (
        <div className="ui">
            <PageHeader
                eyebrow="Content"
                title="Blogs"
                description="Posts published on the website and in the app."
                actions={
                    <LinkButton href="/blogs/create" variant="primary">
                        <Plus className="tw-h-4 tw-w-4" aria-hidden /> New blog
                    </LinkButton>
                }
            />

            {(!loaded || blogsList.length > 0) && (
                <Card className="tw-mb-4 tw-p-4">
                    <ListToolbar
                        search={state.q}
                        onSearch={(q) => update({ q })}
                        placeholder="Title, writer or words in the post"
                        chips={chips}
                        onReset={() => list.reset()}
                        filters={
                            <Field label="Written by">
                                <Select {...list.bind('writer')}>
                                    <option value="">Anyone</option>
                                    {writers.map((w) => (
                                        <option key={w} value={w}>
                                            {w}
                                        </option>
                                    ))}
                                </Select>
                            </Field>
                        }
                        right={
                            <label className="tw-inline-flex tw-items-center tw-gap-2 tw-text-xs tw-text-slate-500">
                                Sort
                                <select
                                    value={`${state.orderBy}:${state.orderType}`}
                                    onChange={(e) => {
                                        const [orderBy, orderType] = e.target.value.split(':');
                                        update({ orderBy, orderType: orderType === 'ASC' ? 'ASC' : 'DESC' });
                                    }}
                                    className="tw-cursor-pointer tw-rounded-lg tw-border tw-border-slate-200 tw-bg-white tw-py-1.5 tw-pl-2 tw-pr-7 tw-text-xs tw-font-medium tw-text-slate-700 focus:tw-border-brand-500 focus:tw-outline-none"
                                >
                                    {SORT_OPTIONS.map((o) => (
                                        <option key={o.value} value={o.value}>
                                            {o.label}
                                        </option>
                                    ))}
                                </select>
                            </label>
                        }
                    />
                </Card>
            )}

            {!loaded ? (
                <div className="tw-grid tw-grid-cols-1 tw-gap-4 sm:tw-grid-cols-2 xl:tw-grid-cols-3">
                    {[0, 1, 2].map((i) => (
                        <Card key={i} className="tw-overflow-hidden">
                            <Skeleton className="tw-aspect-[16/9] tw-w-full tw-rounded-none" />
                            <div className="tw-space-y-2 tw-p-4">
                                <Skeleton className="tw-h-4 tw-w-3/4" />
                                <Skeleton className="tw-h-3 tw-w-full" />
                            </div>
                        </Card>
                    ))}
                </div>
            ) : blogsList.length === 0 ? (
                <Card className="tw-flex tw-flex-col tw-items-center tw-gap-2 tw-py-14 tw-text-sm tw-text-slate-500">
                    <Newspaper className="tw-h-7 tw-w-7 tw-text-slate-400" aria-hidden />
                    No blogs yet.
                </Card>
            ) : total === 0 ? (
                <Card className="tw-flex tw-flex-col tw-items-center tw-gap-2 tw-py-14 tw-text-sm tw-text-slate-500">
                    <Newspaper className="tw-h-7 tw-w-7 tw-text-slate-400" aria-hidden />
                    No blogs match.
                    <span className="tw-text-xs tw-text-slate-400">Try other words or fewer filters.</span>
                </Card>
            ) : (
                <>
                    <ul className="tw-grid tw-grid-cols-1 tw-gap-4 sm:tw-grid-cols-2 xl:tw-grid-cols-3">
                        {pageRows.map((blog) => (
                            <li key={blog.idBlogs}>
                                <Card className="tw-flex tw-h-full tw-flex-col tw-overflow-hidden">
                                    <SafeImg
                                        src={blog.featuredImage ? `${S3_URL}blog-featured-images/${blog.featuredImage}` : null}
                                        alt=""
                                        className="tw-aspect-[16/9] tw-w-full tw-bg-slate-100 tw-object-cover"
                                        fallback={
                                            <span className="tw-flex tw-aspect-[16/9] tw-w-full tw-items-center tw-justify-center tw-bg-slate-50 tw-text-slate-300">
                                                <Newspaper className="tw-h-8 tw-w-8" aria-hidden />
                                            </span>
                                        }
                                    />
                                    <div className="tw-flex tw-flex-1 tw-flex-col tw-p-4">
                                        <h2 className="tw-line-clamp-2 tw-font-semibold tw-leading-snug tw-text-slate-900">{blog.heading}</h2>
                                        <p className="tw-mt-1.5 tw-line-clamp-3 tw-text-sm tw-text-slate-600">{excerpt(blog.description)}</p>
                                        <div className="tw-mt-auto tw-flex tw-flex-wrap tw-items-center tw-gap-x-3 tw-gap-y-1 tw-pt-3 tw-text-xs tw-text-slate-500">
                                            {blog.writtenBy && (
                                                <span className="tw-inline-flex tw-items-center tw-gap-1">
                                                    <PenLine className="tw-h-3.5 tw-w-3.5" aria-hidden /> {blog.writtenBy}
                                                </span>
                                            )}
                                            {blog.writtenDate && (
                                                <span className="tw-inline-flex tw-items-center tw-gap-1 tw-tabular-nums">
                                                    <CalendarDays className="tw-h-3.5 tw-w-3.5" aria-hidden /> {date(String(blog.writtenDate))}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="tw-flex tw-justify-end tw-gap-1.5 tw-border-t tw-border-slate-100 tw-px-3 tw-py-2">
                                        <Button size="sm" variant="danger-outline" onClick={() => handleDelete(blog.idBlogs)}>
                                            <Trash2 className="tw-h-3.5 tw-w-3.5" aria-hidden /> Delete
                                        </Button>
                                        <LinkButton href={`/blogs/edit/${blog.idBlogs}`} size="sm">
                                            <Pencil className="tw-h-3.5 tw-w-3.5" aria-hidden /> Edit
                                        </LinkButton>
                                    </div>
                                </Card>
                            </li>
                        ))}
                    </ul>
                    <Card className="tw-mt-4 tw-px-4 tw-py-3">
                        <ListFooter page={state.page} pageSize={state.pageSize} total={total} noun="blogs" onPage={(page) => update({ page })} onPageSize={(pageSize) => update({ pageSize })} />
                    </Card>
                </>
            )}
        </div>
    )
}

export default List;

List.getLayout = function PageLayout(page: any) {
    return (
        <MainLayout>
            {page}
        </MainLayout>
    )
}
