import React, { useState, useRef } from 'react';
import { API_URL } from '@/config/public';
import MainLayout from '@/layouts/MainLayout';
import Swal from 'sweetalert2';
import { getCookie } from '@/utils/GetCookie';
import { Loader2 } from 'lucide-react';
import { Card } from '@/ui/primitives';
import { Button, LinkButton } from '@/ui/controls';
import { PageHeader } from '@/ui/layout';
import { LocalPreview } from '@/components/projects/ProjectFormParts';
import { BlogFormFields } from '@/components/blogs/BlogFormFields';

interface FormDataType {
    heading: string,
    headingBn: string,
    description: string,
    writtenBy: string,
    writtenDate: string,
    featuredImage: File | null;
}

function Blogs() {
    const [formData, setFormData] = useState<FormDataType>({
        heading: '',
        headingBn: '',
        description: '',
        writtenBy: '',
        writtenDate: '',
        featuredImage: null
    });
    const descriptionRef = useRef<any>(null);
    // The Bangla body needs its own editor instance — a plain textarea would
    // strip the formatting that the English body is allowed to carry.
    const descriptionBnRef = useRef<any>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [loading, setLoading] = useState<boolean>(false);

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
            Swal.fire({ icon: 'info', title: 'The editor is still loading', text: 'Give it a moment, then publish again.' });
            return;
        }
        setLoading(true);
        Swal.fire({
            title: 'Are you sure?',
            text: "You want to create this blog!",
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

                    const res = await fetch(API_URL + 'api/blogs/create', {
                        method: 'POST',
                        headers: { 'Authorization': 'Bearer ' + getCookie('saathi-token') },
                        body: newFormData,
                    });

                    if (res.status === 200) {
                        Swal.fire({
                            icon: 'success',
                            title: 'Success',
                            text: 'Blog created successfully!',
                        });
                        setFormData({
                            heading: '',
                            headingBn: '',
                            description: '',
                            writtenBy: '',
                            writtenDate: '',
                            featuredImage: null
                        });
                        if (fileInputRef.current) {
                            fileInputRef.current.value = '';  // Clear file input
                        }
                        descriptionRef.current.setContent('');
                        descriptionBnRef.current?.setContent('');
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

    return (
        <div className="ui">
            <PageHeader eyebrow="Content" title="New blog" description="Written once in English, optionally in Bangla; published on the website and in the app." />
            <form onSubmit={handleSubmit} className="tw-grid tw-grid-cols-1 tw-items-start tw-gap-6 xl:tw-grid-cols-[minmax(0,1fr)_17rem]">
                <div className="tw-min-w-0 tw-space-y-6">
                    <BlogFormFields
                        heading={formData.heading}
                        headingBn={formData.headingBn}
                        writtenBy={formData.writtenBy}
                        writtenDate={formData.writtenDate}
                        onChange={handleOnChange}
                        onImage={handleFileUpload}
                        fileInputRef={fileInputRef}
                        onEnglishEditor={(editor) => (descriptionRef.current = editor)}
                        onBanglaEditor={(editor) => (descriptionBnRef.current = editor)}
                        imagePreview={
                            formData.featuredImage instanceof File ? (
                                <LocalPreview file={formData.featuredImage} className="tw-mt-3 tw-aspect-[16/9] tw-w-full tw-max-w-sm tw-rounded-xl tw-object-cover tw-ring-1 tw-ring-slate-200" />
                            ) : null
                        }
                    />
                </div>
                <aside className="xl:tw-sticky xl:tw-top-24">
                    <Card className="tw-p-5">
                        <h2 className="tw-text-sm tw-font-semibold tw-text-slate-900">Publish</h2>
                        <p className="tw-mt-1 tw-text-xs tw-text-slate-500">Goes live as soon as it is created.</p>
                        <Button variant="primary" type="submit" className="tw-mt-4 tw-w-full" disabled={loading}>
                            {loading && <Loader2 className="tw-h-4 tw-w-4 tw-animate-spin" aria-hidden />}
                            {loading ? 'Publishing…' : 'Publish blog'}
                        </Button>
                        <LinkButton href="/blogs/list" variant="ghost" className="tw-mt-2 tw-w-full">
                            Back to blogs
                        </LinkButton>
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
