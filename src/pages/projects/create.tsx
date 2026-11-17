import React, { useEffect, useState, useRef, useContext } from 'react';
import { API_URL } from '@/config/public';
import MainLayout from '@/layouts/MainLayout';
import { AppContext } from '@/context/AppContext';
import Swal from 'sweetalert2';
import { getCookie } from '@/utils/GetCookie';
import { useRouter } from 'next/router';
import { Check, Circle, Loader2 } from 'lucide-react';
import { Card, Segmented, cx } from '@/ui/primitives';
import { Button, Field, FileInput, Input, Required, Select } from '@/ui/controls';
import { PageHeader } from '@/ui/layout';
import { FormSection, LocalPreview, PlanFacts, SummaryEditor } from '@/components/projects/ProjectFormParts';

interface FormDataType {
	projectName: string,
	// Bangla counterparts — all optional; blank falls back to the English field.
	projectNameBn: string,
	locationBn: string,
	otherLocationsBn: string,
	unitInvestmentValue: number,
	projectType?: 'regular' | 'special',
	investment: {
		label: string,
		value: number,
		duration?: number,
		maximumReturn?: number,
		minimumReturn?: number,
		tenure?: string,
		investmentType?: string,
		returnType?: string
	},
	ProjectProperty: {
		cattleLiveWeightRate: number,
		cattleInitialWeightMin: number,
		cattleInitialWeightMax: number,
		cattleFinalWeightMin: number,
		cattleFinalWeightMax: number,
	},
	summary: string,
	location: string,
	createdBy: number | null,
	totalReturnMin: number,
	totalReturnMax: number,
	collectionStarts: string,
	collectionEnds: string,
	otherLocations: string,
	showInUpcoming?: 'yes' | 'no',
	mainImage?: any,
	featuredImages?: any,
	projectCategory: {
		label: string,
		value: number
	},
	totalAvailableUnits: number,
	investorUnitCapacity: number,
}

interface InvestmentPlan {
	value: number,
	label: string,
	duration?: number,
	maximumReturn?: number,
	minimumReturn?: number,
	tenure?: string,
	investmentType?: string,
	returnType?: string
}

interface ProjectCategory {
	value: number,
	label: string
}

function Projects() {
	const { currentUser } = useContext(AppContext);
	const router = useRouter();
	const [formData, setFormData] = useState<FormDataType>({
		projectName: '',
		projectNameBn: '',
		locationBn: '',
		otherLocationsBn: '',
		unitInvestmentValue: 0,
		projectType: 'regular',
		investment: {
			label: 'Select Investment Plan',
			value: 0
		},
		ProjectProperty: {
			cattleLiveWeightRate: 0,
			cattleInitialWeightMin: 0,
			cattleInitialWeightMax: 0,
			cattleFinalWeightMin: 0,
			cattleFinalWeightMax: 0,
		},
		summary: '',
		location: '',
		createdBy: null,
		totalReturnMin: 0,
		totalReturnMax: 0,
		collectionStarts: '',
		collectionEnds: '',
		otherLocations: '',
		mainImage: '',
		featuredImages: '',
		showInUpcoming: 'no',
		projectCategory: {
			label: 'Select project category',
			value: 0
		},
		totalAvailableUnits: 0,
		investorUnitCapacity: 0
	});
	const [investmentPlans, setInvestmentPlans] = useState<InvestmentPlan[]>([]);
	const [projectCategories, setProjectCategories] = useState<ProjectCategory[]>([]);
	const editorRef = useRef<any>(null);
	// Bangla summary gets its own editor instance — the summary is rich text.
	const summaryBnRef = useRef<any>(null);
	const mainImageRef = useRef<HTMLInputElement>(null);
	const featuredImagesRef = useRef<HTMLInputElement>(null);
	const [loading, setLoading] = useState<boolean>(false);

	const handleOnChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		setFormData({ ...formData, [e.target.name]: e.target.value });
	}

	useEffect(() => {
		const fetchInvestmentPlans = async () => {
			try {
				const res = await fetch(API_URL + 'api/investment_plans');
				const data = await res.json();
				if (res.status === 200) {
					const plans = data.data.map((plan: any) => {
						return {
							value: plan.idInvestmentSetup,
							label: plan.planName,
							duration: plan.duration,
							maximumReturn: plan.maximumReturn,
							minimumReturn: plan.minimumReturn,
							tenure: plan.tenure,
							investmentType: plan.investmentType,
							returnType: plan.returnType

						}
					});
					setInvestmentPlans(plans);
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
		fetchInvestmentPlans();
	}, []);

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

	useEffect(() => {
		if (formData.investment.value !== 0 && formData.unitInvestmentValue !== 0) {
			const minimumAmountReturn = Number(formData.unitInvestmentValue) + (formData.unitInvestmentValue * (formData.investment.minimumReturn ?? 0) / 100);
			const maximumAmountReturn = Number(formData.unitInvestmentValue) + (formData.unitInvestmentValue * (formData.investment.maximumReturn ?? 0) / 100);
			setFormData({
				...formData,
				totalReturnMin: minimumAmountReturn,
				totalReturnMax: maximumAmountReturn
			});
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [formData.investment, formData.unitInvestmentValue]);

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

			for (let i = 0; i < files.length; i++) {
				const fileType = files[i].type;
				if (!validImageTypes.includes(fileType)) {
					invalidFiles.push(files[i].name);
				}
			}

			if (invalidFiles.length > 0) {
				Swal.fire({
					icon: 'error',
					title: 'Error',
					text: `Invalid file type. The following files are not jpeg, jpg, or png images: ${invalidFiles.join(', ')}`,
				});
			} else {
				setFormData({ ...formData, featuredImages: files });
			}
		}
	}


	const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		// The summary is read from the editor; until it has loaded there is nothing to read.
		if (!editorRef.current) {
			Swal.fire({ icon: 'info', title: 'The summary editor is still loading', text: 'Give it a moment, then create again.' });
			return;
		}
		setLoading(true);
		Swal.fire({
			title: 'Are you sure?',
			text: "You want to create this project!",
			icon: 'warning',
			showCancelButton: true,
			cancelButtonText: 'No',
			confirmButtonText: 'Yes'
		}).then(async (result) => {
			if (result.value) {
				try {
					formData.createdBy = currentUser?.idUsers || null;
					const newFormData = new FormData();
					newFormData.append('projectName', formData.projectName);
					newFormData.append('projectType', formData.projectType || 'regular');
					newFormData.append('unitInvestmentValue', formData.unitInvestmentValue.toString());
					newFormData.append('summary', editorRef.current.getContent());
					newFormData.append('location', formData.location);
					newFormData.append('createdBy', formData.createdBy?.toString() || '');
					newFormData.append('totalReturnMin', formData.totalReturnMin.toString());
					newFormData.append('totalReturnMax', formData.totalReturnMax.toString());
					newFormData.append('collectionStarts', formData.collectionStarts);
					newFormData.append('collectionEnds', formData.collectionEnds);
					newFormData.append('otherLocations', formData.otherLocations);
					newFormData.append('projectNameBn', formData.projectNameBn || '');
					newFormData.append('locationBn', formData.locationBn || '');
					newFormData.append('otherLocationsBn', formData.otherLocationsBn || '');
					newFormData.append('summaryBn', summaryBnRef.current ? summaryBnRef.current.getContent() : '');
					newFormData.append('mainImage', formData.mainImage);
					newFormData.append('investment', JSON.stringify(formData.investment));
					newFormData.append('ProjectProperty', JSON.stringify(formData.ProjectProperty));
					newFormData.append('showInUpcoming', formData.showInUpcoming || 'no');
					newFormData.append('projectCategory', formData.projectCategory.value.toString());
					newFormData.append('totalAvailableUnits', formData.totalAvailableUnits.toString());
					newFormData.append('investorUnitCapacity', formData.investorUnitCapacity.toString());
					if (formData.featuredImages) {
						for (let i = 0; i < formData.featuredImages.length; i++) {
							newFormData.append('featuredImages', formData.featuredImages[i]);
						}
					}

					const res = await fetch(API_URL + 'api/projects/create', {
						method: 'POST',
						headers: { 'Authorization': 'Bearer ' + getCookie('saathi-token') },
						body: newFormData,
					});
					if (res.status === 200) {
						Swal.fire({
							icon: 'success',
							title: 'Success',
							text: 'Projects creation successfull!',
						});
						router.push('/projects/details/' + (await res.json()).data.idProjects);

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

	const setProperty = (key: keyof FormDataType['ProjectProperty'], value: string) =>
		setFormData({ ...formData, ProjectProperty: { ...formData.ProjectProperty, [key]: Number(value) } });

	/* What the server will ask for; shown as a checklist, never enforced here. */
	const checklist: [string, boolean][] = [
		['Project name', Boolean(formData.projectName)],
		['Unit price', Number(formData.unitInvestmentValue) > 0],
		['Category', Boolean(formData.projectCategory.value)],
		['Investment plan', Boolean(formData.investment.value)],
		['Collection dates', Boolean(formData.collectionStarts && formData.collectionEnds)],
		['Location', Boolean(formData.location)],
	];
	const featuredFiles: File[] = formData.featuredImages ? Array.from(formData.featuredImages as FileList) : [];

	return (
		<div className="ui">
			<PageHeader
				eyebrow="Projects"
				title="New project"
				description="Set a project up from an investment plan: the plan fixes its return and term, you set the price, dates and story."
			/>

			<form onSubmit={handleSubmit} className="tw-grid tw-grid-cols-1 tw-items-start tw-gap-6 xl:tw-grid-cols-[minmax(0,1fr)_19rem]">
				<div className="tw-min-w-0 tw-space-y-6">
					<FormSection title="Basics" description="Bangla fields are optional; the app falls back to English when they are blank.">
						<div className="tw-grid tw-grid-cols-1 tw-gap-4 sm:tw-grid-cols-2">
							<Field label={<>Project name<Required /></>}>
								<Input type="text" placeholder="e.g. Project Cattle 04" name="projectName" onChange={handleOnChange} value={formData.projectName} />
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
							<Field label={<>Price per unit (৳)<Required /></>} hint="Investors buy whole units at this price.">
								{/* Blank rather than "0" until typed: a leading 0 turned 25000 into 250000. */}
								<Input type="number" placeholder="e.g. 25000" name="unitInvestmentValue" onChange={handleOnChange} value={formData.unitInvestmentValue || ''} />
							</Field>
						</div>
					</FormSection>

					<FormSection title="Investment plan" description="The return range, return type and term come from the plan.">
						<div className="tw-space-y-4">
							<Field label={<>Plan<Required /></>} className="sm:tw-max-w-md">
								<Select
									id="investmentPlan"
									value={formData.investment.value || ''}
									onChange={(e) => {
										const plan = investmentPlans.find((p) => p.value === Number(e.target.value));
										setFormData({ ...formData, investment: plan ? plan : { label: 'Select investment plan', value: 0 } });
									}}
								>
									<option value="" disabled>
										{investmentPlans.length ? 'Choose a plan' : 'Loading…'}
									</option>
									{investmentPlans.map((plan) => (
										<option key={plan.value} value={plan.value}>
											{plan.label}
										</option>
									))}
								</Select>
							</Field>
							<PlanFacts plan={formData.investment} totalReturnMin={formData.totalReturnMin} totalReturnMax={formData.totalReturnMax} />
						</div>
					</FormSection>

					<FormSection title="Collection and capacity">
						<div className="tw-grid tw-grid-cols-1 tw-gap-4 sm:tw-grid-cols-3">
							<Field label={<>Collection starts<Required /></>}>
								<Input type="date" name="collectionStarts" onChange={handleOnChange} value={formData.collectionStarts} />
							</Field>
							<Field label={<>Collection ends<Required /></>}>
								<Input type="date" name="collectionEnds" onChange={handleOnChange} value={formData.collectionEnds} />
							</Field>
							<Field label="Units per investor" hint="0 means no limit.">
								<Input type="number" placeholder="e.g. 10" name="investorUnitCapacity" onChange={handleOnChange} value={formData.investorUnitCapacity || ''} />
							</Field>
						</div>
					</FormSection>

					<FormSection title="Location">
						<div className="tw-grid tw-grid-cols-1 tw-gap-4 sm:tw-grid-cols-2">
							<Field label={<>Location<Required /></>}>
								<Input type="text" placeholder="e.g. Rangunia, Chattogram" name="location" onChange={handleOnChange} value={formData.location} />
							</Field>
							<Field label="Location (বাংলা)">
								<Input type="text" lang="bn" placeholder="প্রকল্পের অবস্থান — ঐচ্ছিক" name="locationBn" onChange={handleOnChange} value={formData.locationBn} />
							</Field>
							<Field label="Other locations">
								<Input type="text" placeholder="Other places the project runs" name="otherLocations" onChange={handleOnChange} value={formData.otherLocations} />
							</Field>
							<Field label="Other locations (বাংলা)">
								<Input type="text" lang="bn" placeholder="অন্যান্য অবস্থান — ঐচ্ছিক" name="otherLocationsBn" onChange={handleOnChange} value={formData.otherLocationsBn} />
							</Field>
						</div>
					</FormSection>

					<FormSection title="Summary" description="What investors read about the project in the app.">
						<div className="tw-space-y-5">
							<SummaryEditor id="summary" height={400} onInit={(editor) => (editorRef.current = editor)} />
							<div>
								{/* Bangla summary. Optional — blank falls back to the English
									summary. Own editor instance, Bangla-capable font stack. */}
								<p className="tw-mb-1.5 tw-text-xs tw-font-medium tw-text-slate-600">Summary (বাংলা) — optional; falls back to the English summary if left blank</p>
								<SummaryEditor id="summaryBn" height={400} bangla onInit={(editor) => (summaryBnRef.current = editor)} />
							</div>
						</div>
					</FormSection>

					<FormSection title="Images" description="JPEG or PNG.">
						<div className="tw-grid tw-grid-cols-1 tw-gap-5 sm:tw-grid-cols-2">
							<div>
								<Field label="Main image">
									<FileInput accept="image/jpeg,image/png" onChange={handleFileUpload} ref={mainImageRef} />
								</Field>
								{formData.mainImage instanceof File && (
									<LocalPreview file={formData.mainImage} className="tw-mt-3 tw-aspect-[4/3] tw-w-full tw-max-w-xs tw-rounded-xl tw-object-cover tw-ring-1 tw-ring-slate-200" />
								)}
							</div>
							<div>
								<Field label="Featured images" hint="Choosing again replaces the selection.">
									<FileInput accept="image/jpeg,image/png" multiple onChange={handleFeatureImageUpload} ref={featuredImagesRef} />
								</Field>
								{featuredFiles.length > 0 && (
									<ul className="tw-mt-3 tw-grid tw-grid-cols-3 tw-gap-2">
										{featuredFiles.map((file, index) => (
											<li key={index}>
												<LocalPreview file={file} className="tw-aspect-square tw-w-full tw-rounded-lg tw-object-cover tw-ring-1 tw-ring-slate-200" />
											</li>
										))}
									</ul>
								)}
							</div>
						</div>
					</FormSection>

					<FormSection title="Publishing">
						<div className="tw-flex tw-flex-wrap tw-gap-8">
							<div>
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
							</div>
							<div>
								<p className="tw-mb-1.5 tw-text-xs tw-font-medium tw-text-slate-600">Project type</p>
								<Segmented<'regular' | 'special'>
									label="Project type"
									value={formData.projectType || 'regular'}
									onChange={(value) => setFormData({ ...formData, projectType: value })}
									options={[
										{ value: 'regular', label: 'Regular' },
										{ value: 'special', label: 'Special' },
									]}
								/>
							</div>
						</div>
						{formData.projectType === 'special' && (
							<div className="tw-mt-5 tw-rounded-xl tw-border tw-border-violet-200 tw-bg-violet-50/40 tw-p-4">
								<p className="tw-text-xs tw-font-semibold tw-uppercase tw-tracking-wider tw-text-violet-700">Special project property</p>
								<div className="tw-mt-3 tw-grid tw-grid-cols-2 tw-gap-4 sm:tw-grid-cols-5">
									<Field label="Live weight rate" className="tw-col-span-2 sm:tw-col-span-1">
										<Input type="number" name="cattleLiveWeightRate" onChange={(e) => setProperty('cattleLiveWeightRate', e.target.value)} value={formData.ProjectProperty.cattleLiveWeightRate} />
									</Field>
									<Field label="Initial weight, min">
										<Input type="number" name="cattleInitialWeightMin" onChange={(e) => setProperty('cattleInitialWeightMin', e.target.value)} value={formData.ProjectProperty.cattleInitialWeightMin} />
									</Field>
									<Field label="Initial weight, max">
										<Input type="number" name="cattleInitialWeightMax" onChange={(e) => setProperty('cattleInitialWeightMax', e.target.value)} value={formData.ProjectProperty.cattleInitialWeightMax} />
									</Field>
									<Field label="Final weight, min">
										<Input type="number" name="cattleFinalWeightMin" onChange={(e) => setProperty('cattleFinalWeightMin', e.target.value)} value={formData.ProjectProperty.cattleFinalWeightMin} />
									</Field>
									<Field label="Final weight, max">
										<Input type="number" name="cattleFinalWeightMax" onChange={(e) => setProperty('cattleFinalWeightMax', e.target.value)} value={formData.ProjectProperty.cattleFinalWeightMax} />
									</Field>
								</div>
							</div>
						)}
					</FormSection>
				</div>

				<aside className="xl:tw-sticky xl:tw-top-24">
					<Card className="tw-p-5">
						<h2 className="tw-text-sm tw-font-semibold tw-text-slate-900">Before you create</h2>
						<ul className="tw-mt-3 tw-space-y-2">
							{checklist.map(([label, done]) => (
								<li key={label} className={cx('tw-flex tw-items-center tw-gap-2 tw-text-sm', done ? 'tw-text-slate-700' : 'tw-text-slate-400')}>
									{done ? (
										<Check className="tw-h-4 tw-w-4 tw-text-emerald-600" aria-hidden />
									) : (
										<Circle className="tw-h-4 tw-w-4" aria-hidden />
									)}
									{label}
								</li>
							))}
						</ul>
						<Button variant="primary" type="submit" className="tw-mt-5 tw-w-full" disabled={loading}>
							{loading && <Loader2 className="tw-h-4 tw-w-4 tw-animate-spin" aria-hidden />}
							{loading ? 'Creating…' : 'Create project'}
						</Button>
						<p className="tw-mt-2 tw-text-center tw-text-xs tw-text-slate-500">You can edit it afterwards; the price and plan are fixed once created.</p>
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
