import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { API_URL } from '@/config/public';
import MainLayout from '@/layouts/MainLayout';
import Swal from 'sweetalert2';
import { getCookie } from '@/utils/GetCookie';
import { useRouter } from 'next/router';
import { getRequestOptions } from "@/utils/Fetch";
import { S3_URL } from '@/config/public';
import { ArrowLeft, ImageOff, Loader2 } from 'lucide-react';
import { Card, SafeImg, Skeleton } from '@/ui/primitives';
import { Button } from '@/ui/controls';
import { LocalPreview } from '@/components/projects/ProjectFormParts';
import { BlogFormFields } from '@/components/blogs/BlogFormFields';

interface FormDataType {
    heading: string,
    headingBn: string,
    description: string,
    descriptionBn: string,
    writtenBy: string,
    writtenDate: string,
    featuredImage: File | null;
}

function Blogs() {
    const router = useRouter();
    const { id } = router.query;
    const [formData, setFormData] = useState<FormDataType>({
        heading: '',
        headingBn: '',
        description: '',
        descriptionBn: '',
        writtenBy: '',
        writtenDate: '',
        featuredImage: null
    });
    const descriptionRef = useRef<any>(null);
    // The Bangla body gets its own editor instance — see blogs/create.tsx.
    const descriptionBnRef = useRef<any>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [loading, setLoading] = useState<boolean>(false);
    const [loaded, setLoaded] = useState<boolean>(false);

    useEffect(() => {
        const fetchBlogs = async () => {
            try {
                const res = await fetch(API_URL + 'api/blogs/edit-info/' + id, getRequestOptions());
                const data = await res.json();
                if (res.status === 200) {
                    const blogData = data.data;
                    setFormData({
                        heading: blogData.heading,
                        headingBn: blogData.headingBn || '',
                        description: blogData.description,
                        descriptionBn: blogData.descriptionBn || '',
                        writtenBy: blogData.writtenBy,
                        writtenDate: blogData.writtenDate,
                        featuredImage: blogData.featuredImage
                    });
                    setLoaded(true);
                } else {
                    Swal.fire({
                        icon: 'error',
                        title: 'Error',
                        text: data.message,
                    });
                }
            } catch (err) {
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: 'Something went wrong!',
                });
            }
        };
        if (id) {
            fetchBlogs();
        }
    }, [id]);

    /*
     * The loaded bodies reach the editors as `initialValue` (BlogFormFields).
     * The old page pushed them in with setContent() when the data arrived; when
     * the editor (from a CDN) started after that, it stayed empty, and saving
     * then posted an empty body over the real post.
     */

    const handleOnChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    }

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            const fileType = file.type;
            const validImageTypes = ['image/jpeg', 'image/png', 'image/jpg'];
            if (validImageTypes.includes(fileType)) {
                setFormData({ ...formData, featuredImage: file });
            } else {
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: 'Invalid file type. Please upload a jpeg, jpg, or png image.',
                });
            }
        }
    }

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!descriptionRef.current) {
            Swal.fire({ icon: 'info', title: 'The editor is still loading', text: 'Give it a moment, then save again.' });
            return;
        }
        setLoading(true);
        Swal.fire({
            title: 'Are you sure?',
            text: "You want to update this blog!",
            icon: 'warning',
            showCancelButton: true,
            cancelButtonText: 'No',
            confirmButtonText: 'Yes'
        }).then(async (result) => {
            if (result.value) {
                try {
                    const newFormData = new FormData();
                    newFormData.append('heading', formData.heading);
                    newFormData.append('description', descriptionRef.current.getContent());
                    newFormData.append('headingBn', formData.headingBn || '');
                    newFormData.append('descriptionBn', descriptionBnRef.current ? descriptionBnRef.current.getContent() : '');
                    newFormData.append('writtenBy', formData.writtenBy);
                    newFormData.append('writtenDate', formData.writtenDate);
                    if (formData.featuredImage !== null)
                        newFormData.append('featuredImage', formData.featuredImage);

                    const res = await fetch(API_URL + 'api/blogs/update/' + id, {
                        method: 'POST',
                        headers: { 'Authorization': 'Bearer ' + getCookie('saathi-token') },
                        body: newFormData,
                    });

                    if (res.status === 200) {
                        Swal.fire({
                            icon: 'success',
                            title: 'Success',
                            text: 'Blog updated successfully!',
                        });
                        router.push('/blogs/list');
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
                finally {
                    setLoading(false);
                }
            } else {
                setLoading(false);
            }
        });
    }

    const existingImage = typeof formData.featuredImage === 'string' && formData.featuredImage ? (formData.featuredImage as string) : null;

    return (
        <div className="ui">
            <Link href="/blogs/list" className="tw-mb-3 tw-inline-flex tw-items-center tw-gap-1.5 tw-text-sm tw-font-medium tw-text-slate-500 hover:tw-text-slate-900">
                <ArrowLeft className="tw-h-4 tw-w-4" aria-hidden /> Blogs
            </Link>
            <div className="tw-mb-6">
                <p className="tw-text-xs tw-font-semibold tw-uppercase tw-tracking-[0.14em] tw-text-brand-700">Edit blog</p>
                {loaded ? (
                    <h1 className="tw-mt-1 tw-text-[26px] tw-font-semibold tw-leading-8 tw-tracking-tight tw-text-slate-900">{formData.heading || 'Untitled blog'}</h1>
                ) : (
                    <Skeleton className="tw-mt-2 tw-h-7 tw-w-72" />
                )}
            </div>
            <form onSubmit={handleSubmit} className="tw-grid tw-grid-cols-1 tw-items-start tw-gap-6 xl:tw-grid-cols-[minmax(0,1fr)_17rem]">
                <div className="tw-min-w-0 tw-space-y-6">
                    <BlogFormFields
                        heading={formData.heading}
                        headingBn={formData.headingBn}
                        writtenBy={formData.writtenBy}
                        writtenDate={formData.writtenDate}
                        description={formData.description || ''}
                        descriptionBn={formData.descriptionBn || ''}
                        onChange={handleOnChange}
                        onImage={handleFileUpload}
                        fileInputRef={fileInputRef}
                        onEnglishEditor={(editor) => (descriptionRef.current = editor)}
                        onBanglaEditor={(editor) => (descriptionBnRef.current = editor)}
                        imagePreview={
                            formData.featuredImage instanceof File ? (
                                <LocalPreview file={formData.featuredImage} className="tw-mt-3 tw-aspect-[16/9] tw-w-full tw-max-w-sm tw-rounded-xl tw-object-cover tw-ring-1 tw-ring-slate-200" />
                            ) : existingImage ? (
                                <SafeImg
                                    src={`${S3_URL}blog-featured-images/${existingImage}`}
                                    alt={formData.heading}
                                    className="tw-mt-3 tw-aspect-[16/9] tw-w-full tw-max-w-sm tw-rounded-xl tw-object-cover tw-ring-1 tw-ring-slate-200"
                                    fallback={
                                        <span className="tw-mt-3 tw-flex tw-aspect-[16/9] tw-w-full tw-max-w-sm tw-items-center tw-justify-center tw-rounded-xl tw-bg-slate-50 tw-text-slate-300 tw-ring-1 tw-ring-slate-200">
                                            <ImageOff className="tw-h-6 tw-w-6" aria-hidden />
                                        </span>
                                    }
                                />
                            ) : null
                        }
                    />
                </div>
                <aside className="xl:tw-sticky xl:tw-top-24">
                    <Card className="tw-p-5">
                        <h2 className="tw-text-sm tw-font-semibold tw-text-slate-900">Save changes</h2>
                        <p className="tw-mt-1 tw-text-xs tw-text-slate-500">The live post updates as soon as you save.</p>
                        {/* Disabled until the post has loaded: saving the empty form would blank it. */}
                        <Button variant="primary" type="submit" className="tw-mt-4 tw-w-full" disabled={loading || !loaded}>
                            {loading && <Loader2 className="tw-h-4 tw-w-4 tw-animate-spin" aria-hidden />}
                            {loading ? 'Saving…' : 'Save blog'}
                        </Button>
                    </Card>
                </aside>
            </form>
        </div>
    );
}

export default Blogs;

Blogs.getLayout = function PageLayout(page: any) {
    return (
        <MainLayout>
            {page}
        </MainLayout>
    )
}
