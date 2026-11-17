import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { API_URL } from '@/config/public';
import MainLayout from '@/layouts/MainLayout';
import Swal from 'sweetalert2';
import { getCookie } from '@/utils/GetCookie';
import { getRequestOptions } from "@/utils/Fetch";
import { S3_URL } from '@/config/public';
import { ArrowLeft, ImageOff, Loader2, Lock, Trash2 } from 'lucide-react';
import { Card, SafeImg, Segmented, Skeleton } from '@/ui/primitives';
import { Button, Field, FileInput, Input, Required, Select } from '@/ui/controls';
import { bdtExact } from '@/ui/format';
import { FormSection, LocalPreview, PlanFacts, SummaryEditor } from '@/components/projects/ProjectFormParts';

interface FormDataType {
	projectName: string,
	// Bangla counterparts — all optional; blank falls back to the English field.
	projectNameBn: string,
	locationBn: string,
	otherLocationsBn: string,
	summaryBn: string,
	unitInvestmentValue: number,
	investment: {
		duration: number,
		maximumReturn: number,
		minimumReturn: number,
		tenure: string,
		investmentType: string,
		returnType: string
	},
	summary: string,
	location: string,
	totalReturnMin: number,
	totalReturnMax: number,
	collectionStarts: string,
	collectionEnds: string,
	otherLocations: string,
	showInUpcoming?: 'yes' | 'no',
	totalAvailableUnits: number,
	investorUnitCapacity: number,
	mainImage?: any,
	featuredImages?: any,
	projectCategory: {
		label: string,
		value: number
	}
}

interface ProjectCategory {
	value: number,
	label: string
}

function Projects() {
	const router = useRouter();
	const { id } = router.query;
	const [formData, setFormData] = useState<FormDataType>({
		projectName: '',
		projectNameBn: '',
		locationBn: '',
		otherLocationsBn: '',
		summaryBn: '',
		unitInvestmentValue: 0,
		investment: {
			duration: 0,
			tenure: '',
			maximumReturn: 0,
			minimumReturn: 0,
			investmentType: '',
			returnType: ''
		},
		summary: '',
		location: '',
		totalReturnMin: 0,
		totalReturnMax: 0,
		collectionStarts: '',
		collectionEnds: '',
		otherLocations: '',
		mainImage: null,
		featuredImages: [],
		showInUpcoming: 'no',
		totalAvailableUnits: 0,
		investorUnitCapacity: 0,
		projectCategory: {
			label: 'Select project category',
			value: 0
		}
	});
	const [projectCategories, setProjectCategories] = useState<ProjectCategory[]>([]);
	const [loaded, setLoaded] = useState<boolean>(false);
	const editorRef = useRef<any>(null);
	// Bangla summary gets its own editor instance — the summary is rich text.
	const summaryBnRef = useRef<any>(null);
	const mainImageRef = useRef<HTMLInputElement>(null);
	const featuredImagesRef = useRef<HTMLInputElement>(null);
	const [loading, setLoading] = useState<boolean>(false);


	useEffect(() => {
		const fetchProjectDetails = async () => {
			try {
				const res = await fetch(API_URL + `api/projects/edit-info/${id}`, getRequestOptions());
				const data = await res.json();
				if (res.status === 200) {
					const project = data.data;
					setFormData({
						projectName: project.projectName,
						unitInvestmentValue: project.unitInvestmentValue,
						projectCategory: {
							label: project.ProjectCategory.categoryName,
							value: project.ProjectCategory.idProjectCategories
						},
						collectionStarts: project.collectionStarts,
						collectionEnds: project.collectionEnds,
						location: project.location,
						otherLocations: project.otherLocations,
						projectNameBn: project.projectNameBn || '',
						locationBn: project.locationBn || '',
						otherLocationsBn: project.otherLocationsBn || '',
						summaryBn: project.summaryBn || '',
						showInUpcoming: project.showInUpcoming,
						totalAvailableUnits: project.totalAvailableUnits,
						investorUnitCapacity: project.investorUnitCapacity,
						investment: {
							duration: project.duration,
							tenure: project.tenure,
							maximumReturn: project.returnRangeMax,
							minimumReturn: project.returnRangeMin,
							investmentType: project.investmentType,
							returnType: project.returnType,

						},
						totalReturnMin: project.totalReturnMin,
						totalReturnMax: project.totalReturnMax,
						summary: project.summary,
						mainImage: project.MainImage,
						featuredImages: project.FeaturedImages
					});
					setLoaded(true);
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
			}
		}
		if (id) {
			fetchProjectDetails();
		}
	}, [id]);

	/*
	 * The loaded summaries reach the editors as `initialValue` (below). The
	 * old page pushed them in with setContent() when the data arrived; when
	 * the editor (from a CDN) started after that, it stayed empty, and saving
	 * then posted an empty summary over the real one.
	 */

	useEffect(() => {
		const fetchProjectCategories = async () => {
			try {
				const res = await fetch(API_URL + 'api/project-categories/get_all_categories');
				const data = await res.json();
				if (res.status === 200) {
					const categories = data.data.map((category: any) => {
						return {
							value: category.idProjectCategories,
							label: category.categoryName
						}
					});
					setProjectCategories(categories);
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
			}
		}
		fetchProjectCategories();
	}
		, []);

	const handleOnChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		setFormData({ ...formData, [e.target.name]: e.target.value });
	}

	const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0];
		if (file) {
			const fileType = file.type;
			const validImageTypes = ['image/jpeg', 'image/png', 'image/jpg'];
			if (validImageTypes.includes(fileType)) {
				setFormData({ ...formData, mainImage: file });
			} else {
				Swal.fire({
					icon: 'error',
					title: 'Error',
					text: 'Invalid file type. Please upload a jpeg, jpg, or png image.',
				});
			}
		}
	}

	const handleFeatureImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
		const files = event.target.files;
		if (files) {
			const validImageTypes = ['image/jpeg', 'image/png', 'image/jpg'];
			const invalidFiles = [];
			const newFilesArray = Array.from(files);

			for (let i = 0; i < newFilesArray.length; i++) {
				const fileType = newFilesArray[i].type;
				if (!validImageTypes.includes(fileType)) {
					invalidFiles.push(newFilesArray[i].name);
				}
			}

			if (invalidFiles.length > 0) {
				Swal.fire({
					icon: 'error',
					title: 'Error',
					text: `Invalid file type. The following files are not jpeg, jpg, or png images: ${invalidFiles.join(', ')}`,
				});
			} else {
				setFormData(prevFormData => ({
					...prevFormData,
					featuredImages: prevFormData.featuredImages
						? [...prevFormData.featuredImages, ...newFilesArray]
						: newFilesArray
				}));
			}
		}
	}

	const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		// The summary is read from the editor; until it has loaded there is nothing to read.
		if (!editorRef.current) {
			Swal.fire({ icon: 'info', title: 'The summary editor is still loading', text: 'Give it a moment, then save again.' });
			return;
		}
		setLoading(true);
		Swal.fire({
			title: 'Are you sure?',
			text: "You want to update this project!",
			icon: 'warning',
			showCancelButton: true,
			cancelButtonText: 'No',
			confirmButtonText: 'Yes'
		}).then(async (result) => {
			if (result.value) {
				try {
					const newFormData = new FormData();
					newFormData.append('projectName', formData.projectName);
					newFormData.append('summary', editorRef.current.getContent());
					newFormData.append('location', formData.location);
					newFormData.append('collectionStarts', formData.collectionStarts);
					newFormData.append('collectionEnds', formData.collectionEnds);
					newFormData.append('otherLocations', formData.otherLocations);
					newFormData.append('projectNameBn', formData.projectNameBn || '');
					newFormData.append('locationBn', formData.locationBn || '');
					newFormData.append('otherLocationsBn', formData.otherLocationsBn || '');
					newFormData.append('summaryBn', summaryBnRef.current ? summaryBnRef.current.getContent() : '');
					newFormData.append('showInUpcoming', formData.showInUpcoming || 'no');
					newFormData.append('projectCategory', formData.projectCategory.value.toString());
					newFormData.append('totalAvailableUnits', formData.totalAvailableUnits.toString());
					newFormData.append('investorUnitCapacity', formData.investorUnitCapacity.toString());
					if (formData.featuredImages) {
						for (let i = 0; i < formData.featuredImages.length; i++) {
							if (formData.featuredImages[i] instanceof File) {
								newFormData.append('featuredImages', formData.featuredImages[i]);
							}
							else {
								newFormData.append('prevFeaturedImages', formData.featuredImages[i].idFiles);
							}
						}
					}
					if (formData.mainImage instanceof File) {
						newFormData.append('mainImage', formData.mainImage);
					}
					const res = await fetch(API_URL + 'api/projects/update/' + id, {
						method: 'POST',
						headers: { 'Authorization': 'Bearer ' + getCookie('saathi-token') },
						body: newFormData,
					});
					if (res.status === 200) {
						Swal.fire({
							icon: 'success',
							title: 'Success',
							text: 'Project updated successfully!',
						});

						router.push('/projects/details/' + id);

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
				} finally {
					setLoading(false);
				}
			} else {
				setLoading(false);
			}
		});
	};

	const removeFeaturedImage = (index: number) => {
		setFormData(prevFormData => ({
			...prevFormData,
			featuredImages: prevFormData.featuredImages?.filter((img: any, i: number) => i !== index)
		}));
	};

	const featured: any[] = formData.featuredImages ?? [];
	const existingMain = formData.mainImage && formData.mainImage.idFiles !== undefined ? formData.mainImage : null;

	return (
		<div className="ui">
			<Link href={`/projects/details/${id ?? ''}`} className="tw-mb-3 tw-inline-flex tw-items-center tw-gap-1.5 tw-text-sm tw-font-medium tw-text-slate-500 hover:tw-text-slate-900">
				<ArrowLeft className="tw-h-4 tw-w-4" aria-hidden /> Back to project
			</Link>
			<div className="tw-mb-6">
				<p className="tw-text-xs tw-font-semibold tw-uppercase tw-tracking-[0.14em] tw-text-brand-700">Edit project{id ? ` #${id}` : ''}</p>
				{loaded ? (
					<h1 className="tw-mt-1 tw-text-[26px] tw-font-semibold tw-leading-8 tw-tracking-tight tw-text-slate-900">{formData.projectName || 'Untitled project'}</h1>
				) : (
					<Skeleton className="tw-mt-2 tw-h-7 tw-w-64" />
				)}
			</div>

			<form onSubmit={handleSubmit} className="tw-grid tw-grid-cols-1 tw-items-start tw-gap-6 xl:tw-grid-cols-[minmax(0,1fr)_19rem]">
				<div className="tw-min-w-0 tw-space-y-6">
					<FormSection title="Basics" description="Bangla fields are optional; the app falls back to English when they are blank.">
						<div className="tw-grid tw-grid-cols-1 tw-gap-4 sm:tw-grid-cols-2">
							<Field label={<>Project name<Required /></>}>
								<Input type="text" placeholder="Name of the project" name="projectName" onChange={handleOnChange} value={formData.projectName} />
							</Field>
							<Field label="Project name (বাংলা)">
								<Input type="text" lang="bn" placeholder="প্রকল্পের নাম — ঐচ্ছিক" name="projectNameBn" onChange={handleOnChange} value={formData.projectNameBn} />
							</Field>
							<Field label={<>Category<Required /></>}>
								<Select
									id="projectCategory"
									value={formData.projectCategory.value || ''}
									onChange={(e) => {
										const category = projectCategories.find((c) => c.value === Number(e.target.value));
										if (category) setFormData({ ...formData, projectCategory: category });
									}}
								>
									<option value="" disabled>
										{projectCategories.length ? 'Choose a category' : 'Loading…'}
									</option>
									{projectCategories.map((category) => (
										<option key={category.value} value={category.value}>
											{category.label}
										</option>
									))}
								</Select>
							</Field>
							<Field label="Price per unit" hint="Fixed once the project is created.">
								<div className="tw-flex tw-items-center tw-gap-2 tw-rounded-xl tw-border tw-border-slate-200 tw-bg-slate-50 tw-px-3 tw-py-2 tw-text-sm tw-text-slate-600">
									<Lock className="tw-h-3.5 tw-w-3.5 tw-text-slate-400" aria-hidden />
									<span className="tw-tabular-nums">{loaded ? bdtExact(Number(formData.unitInvestmentValue)) : '—'}</span>
								</div>
							</Field>
						</div>
					</FormSection>

					<FormSection title="Investment plan" description="Set when the project was created; shown for reference.">
						<PlanFacts plan={formData.investment} totalReturnMin={formData.totalReturnMin} totalReturnMax={formData.totalReturnMax} />
					</FormSection>

					<FormSection title="Collection and capacity">
						<div className="tw-grid tw-grid-cols-1 tw-gap-4 sm:tw-grid-cols-3">
							<Field label={<>Collection starts<Required /></>}>
								<Input type="date" name="collectionStarts" onChange={handleOnChange} value={formData.collectionStarts ?? ''} />
							</Field>
							<Field label={<>Collection ends<Required /></>}>
								<Input type="date" name="collectionEnds" onChange={handleOnChange} value={formData.collectionEnds ?? ''} />
							</Field>
							<Field label="Units per investor" hint="0 means no limit.">
								<Input type="number" placeholder="e.g. 10" name="investorUnitCapacity" onChange={handleOnChange} value={formData.investorUnitCapacity ?? ''} />
							</Field>
						</div>
					</FormSection>

					<FormSection title="Location">
						<div className="tw-grid tw-grid-cols-1 tw-gap-4 sm:tw-grid-cols-2">
							<Field label={<>Location<Required /></>}>
								<Input type="text" placeholder="Project location" name="location" onChange={handleOnChange} value={formData.location ?? ''} />
							</Field>
							<Field label="Location (বাংলা)">
								<Input type="text" lang="bn" placeholder="প্রকল্পের অবস্থান — ঐচ্ছিক" name="locationBn" onChange={handleOnChange} value={formData.locationBn} />
							</Field>
							<Field label="Other locations">
								<Input type="text" placeholder="Other places the project runs" name="otherLocations" onChange={handleOnChange} value={formData.otherLocations ?? ''} />
							</Field>
							<Field label="Other locations (বাংলা)">
								<Input type="text" lang="bn" placeholder="অন্যান্য অবস্থান — ঐচ্ছিক" name="otherLocationsBn" onChange={handleOnChange} value={formData.otherLocationsBn} />
							</Field>
						</div>
					</FormSection>

					<FormSection title="Summary" description="What investors read about the project in the app.">
						<div className="tw-space-y-5">
							<SummaryEditor id="summary" height={350} initialValue={formData.summary || ''} onInit={(editor) => (editorRef.current = editor)} />
							<div>
								{/* Bangla summary. Optional — blank falls back to the English
									summary. Own editor instance, Bangla-capable font stack. */}
								<p className="tw-mb-1.5 tw-text-xs tw-font-medium tw-text-slate-600">Summary (বাংলা) — optional; falls back to the English summary if left blank</p>
								<SummaryEditor id="summaryBn" height={350} bangla initialValue={formData.summaryBn || ''} onInit={(editor) => (summaryBnRef.current = editor)} />
							</div>
						</div>
					</FormSection>

					<FormSection title="Images" description="JPEG or PNG. New featured images are added to the existing ones.">
						<div className="tw-grid tw-grid-cols-1 tw-gap-6 md:tw-grid-cols-[18rem_minmax(0,1fr)]">
							<div>
								<p className="tw-mb-1.5 tw-text-xs tw-font-medium tw-text-slate-600">Main image</p>
								{existingMain ? (
									<a href={`${S3_URL}project-main-image/${id}/${existingMain.fileName}`} target="_blank" rel="noopener noreferrer" className="tw-block">
										<SafeImg
											src={`${S3_URL}project-main-image/${id}/${existingMain.fileName}`}
											alt={existingMain.originalFileName}
											className="tw-aspect-[4/3] tw-w-full tw-rounded-xl tw-object-cover tw-ring-1 tw-ring-slate-200"
											fallback={
												<span className="tw-flex tw-aspect-[4/3] tw-w-full tw-items-center tw-justify-center tw-rounded-xl tw-bg-slate-50 tw-text-slate-300 tw-ring-1 tw-ring-slate-200">
													<ImageOff className="tw-h-6 tw-w-6" aria-hidden />
												</span>
											}
										/>
									</a>
								) : formData.mainImage instanceof File ? (
									<LocalPreview file={formData.mainImage} className="tw-aspect-[4/3] tw-w-full tw-rounded-xl tw-object-cover tw-ring-1 tw-ring-slate-200" />
								) : (
									<span className="tw-flex tw-aspect-[4/3] tw-w-full tw-flex-col tw-items-center tw-justify-center tw-gap-1 tw-rounded-xl tw-border tw-border-dashed tw-border-slate-200 tw-text-xs tw-text-slate-400">
										<ImageOff className="tw-h-6 tw-w-6" aria-hidden /> No main image
									</span>
								)}
								<FileInput className="tw-mt-3" accept="image/jpeg,image/png" onChange={handleFileUpload} ref={mainImageRef} aria-label="Replace the main image" />
							</div>
							<div className="tw-min-w-0">
								<p className="tw-mb-1.5 tw-text-xs tw-font-medium tw-text-slate-600">Featured images</p>
								{featured.length === 0 ? (
									<p className="tw-rounded-xl tw-border tw-border-dashed tw-border-slate-200 tw-px-4 tw-py-6 tw-text-center tw-text-sm tw-text-slate-400">No featured images</p>
								) : (
									<ul className="tw-grid tw-grid-cols-2 tw-gap-3 sm:tw-grid-cols-3">
										{featured.map((image: any, index: number) => {
											const isNew = image instanceof File;
											return (
												<li key={isNew ? `new-${index}-${image.name}` : image.idFiles} className="tw-overflow-hidden tw-rounded-xl tw-border tw-border-slate-200">
													{isNew ? (
														<LocalPreview file={image} className="tw-aspect-[4/3] tw-w-full tw-object-cover" />
													) : (
														<a href={`${S3_URL}project-featured-image/${id}/${image.fileName}`} target="_blank" rel="noopener noreferrer" className="tw-block">
															<SafeImg
																src={`${S3_URL}project-featured-image/${id}/${image.fileName}`}
																alt={image.originalFileName}
																className="tw-aspect-[4/3] tw-w-full tw-object-cover"
																fallback={
																	<span className="tw-flex tw-aspect-[4/3] tw-w-full tw-items-center tw-justify-center tw-bg-slate-50 tw-text-slate-300">
																		<ImageOff className="tw-h-5 tw-w-5" aria-hidden />
																	</span>
																}
															/>
														</a>
													)}
													<div className="tw-flex tw-items-center tw-gap-2 tw-border-t tw-border-slate-200 tw-bg-white tw-px-2.5 tw-py-1.5">
														<span className="tw-min-w-0 tw-flex-1 tw-truncate tw-text-xs tw-text-slate-600" title={isNew ? image.name : image.originalFileName}>
															{isNew ? image.name : image.originalFileName}
														</span>
														{isNew && <span className="tw-rounded tw-bg-sky-50 tw-px-1.5 tw-text-[10px] tw-font-semibold tw-text-sky-700">NEW</span>}
														<button
															type="button"
															onClick={() => removeFeaturedImage(index)}
															className="tw-rounded-md tw-p-1 tw-text-slate-400 hover:tw-bg-rose-50 hover:tw-text-rose-600"
															aria-label={`Remove ${isNew ? image.name : image.originalFileName}`}
														>
															<Trash2 className="tw-h-3.5 tw-w-3.5" aria-hidden />
														</button>
													</div>
												</li>
											);
										})}
									</ul>
								)}
								<FileInput className="tw-mt-3" accept="image/jpeg,image/png" multiple onChange={handleFeatureImageUpload} ref={featuredImagesRef} aria-label="Add featured images" />
							</div>
						</div>
					</FormSection>

					<FormSection title="Publishing">
						<p className="tw-mb-1.5 tw-text-xs tw-font-medium tw-text-slate-600">Show in upcoming</p>
						<Segmented<'no' | 'yes'>
							label="Show in upcoming"
							value={formData.showInUpcoming || 'no'}
							onChange={(value) => setFormData({ ...formData, showInUpcoming: value })}
							options={[
								{ value: 'no', label: 'No' },
								{ value: 'yes', label: 'Yes' },
							]}
						/>
					</FormSection>
				</div>

				<aside className="xl:tw-sticky xl:tw-top-24">
					<Card className="tw-p-5">
						<h2 className="tw-text-sm tw-font-semibold tw-text-slate-900">Save changes</h2>
						<p className="tw-mt-1 tw-text-xs tw-text-slate-500">Removed images are dropped when you save; new ones are uploaded.</p>
						<Button variant="primary" type="submit" className="tw-mt-4 tw-w-full" disabled={loading || !loaded}>
							{loading && <Loader2 className="tw-h-4 tw-w-4 tw-animate-spin" aria-hidden />}
							{loading ? 'Saving…' : 'Save project'}
						</Button>
						<Link href={`/projects/details/${id ?? ''}`} className="tw-mt-2 tw-block tw-text-center tw-text-xs tw-font-medium tw-text-slate-500 hover:tw-text-slate-800">
							Cancel
						</Link>
					</Card>
				</aside>
			</form>
		</div>
	);
}

export default Projects;

Projects.getLayout = function PageLayout(page: any) {
	return (
		<MainLayout>
			{page}
		</MainLayout>
	)
}
