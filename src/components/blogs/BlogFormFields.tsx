import type { ChangeEvent, ReactNode, RefObject } from 'react';
import { Field, FileInput, Input, Required } from '@/ui/controls';
import { FormSection, SummaryEditor } from '@/components/projects/ProjectFormParts';

/**
 * The fields New post and Edit post share. Each page keeps its own state,
 * payload and submit handler.
 */
type Props = {
    heading: string;
    headingBn: string;
    writtenBy: string;
    writtenDate: string;
    onChange: (e: ChangeEvent<HTMLInputElement>) => void;
    onImage: (e: ChangeEvent<HTMLInputElement>) => void;
    fileInputRef: RefObject<HTMLInputElement>;
    imagePreview: ReactNode;
    onEnglishEditor: (editor: any) => void;
    onBanglaEditor: (editor: any) => void;
    /** Loaded copy for Edit post; see SummaryEditor for why it goes in this way. */
    description?: string;
    descriptionBn?: string;
};

export function BlogFormFields(props: Props) {
    return (
        <>
            <FormSection title="Post" description="The Bangla heading and body are optional; blank falls back to the English.">
                <div className="tw-space-y-4">
                    <Field label={<>Heading<Required /></>}>
                        <Input type="text" placeholder="Heading of the post" name="heading" onChange={props.onChange} value={props.heading ?? ''} />
                    </Field>
                    <Field label="Heading (বাংলা)">
                        <Input type="text" lang="bn" placeholder="ব্লগের শিরোনাম লিখুন" name="headingBn" onChange={props.onChange} value={props.headingBn ?? ''} />
                    </Field>
                    <div>
                        <p className="tw-mb-1.5 tw-text-xs tw-font-medium tw-text-slate-600">Body</p>
                        <SummaryEditor id="painPoints" height={420} initialValue={props.description} onInit={props.onEnglishEditor} />
                    </div>
                    <div>
                        {/* Bangla body. Optional — blank falls back to the English one. Its own
                            editor instance, with a Bangla-capable font stack so the editing
                            surface renders the script instead of tofu boxes. */}
                        <p className="tw-mb-1.5 tw-text-xs tw-font-medium tw-text-slate-600">Body (বাংলা)</p>
                        <SummaryEditor id="descriptionBn" height={420} bangla initialValue={props.descriptionBn} onInit={props.onBanglaEditor} />
                    </div>
                </div>
            </FormSection>
            <FormSection title="Byline and image">
                <div className="tw-grid tw-grid-cols-1 tw-gap-4 sm:tw-grid-cols-2">
                    <Field label={<>Written by<Required /></>}>
                        <Input type="text" placeholder="Writer's name" name="writtenBy" onChange={props.onChange} value={props.writtenBy ?? ''} />
                    </Field>
                    <Field label={<>Written on<Required /></>}>
                        <Input type="date" name="writtenDate" onChange={props.onChange} value={props.writtenDate ?? ''} />
                    </Field>
                    <div className="sm:tw-col-span-2">
                        <Field label="Featured image" hint="JPEG or PNG.">
                            <FileInput accept="image/jpeg,image/png" name="categoryImage" onChange={props.onImage} ref={props.fileInputRef} />
                        </Field>
                        {props.imagePreview}
                    </div>
                </div>
            </FormSection>
        </>
    );
}
