import React, { useEffect, useState, useRef, useContext } from 'react';
import { Button, Col, Container, Form, Row, Card, Spinner } from 'react-bootstrap';
import { API_URL } from '@/config/public';
import MainLayout from '@/layouts/MainLayout';
import Select from 'react-select';
import { Editor } from '@tinymce/tinymce-react';
import { AppContext } from '@/context/AppContext';
import Swal from 'sweetalert2';
import { getCookie } from '@/utils/GetCookie';
import { useRouter } from 'next/router';

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
	label: string
}

interface ProjectCategory {
	value: number,
	label: string
}

function Projects() {
	const { token, currentUser } = useContext(AppContext);
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
	return (
		<>
			<Container>
				<h4 className="text-start">Project Creation</h4>
				<hr />
				<Form onSubmit={handleSubmit}>
					<Row>
						<Col md={6}>
							<Form.Group as={Row} className='mb-3'>
								<Form.Label column sm='4' >Name of the project <span className='text-danger'>*</span></Form.Label>
								<Col sm='8'>
									<Form.Control type="text" placeholder="Enter name of the project" name="projectName" onChange={handleOnChange} value={formData.projectName} />
									{/* Bangla counterpart — optional; blank falls back to English. */}
									<Form.Control className="mt-2" type="text" lang="bn" placeholder="প্রকল্পের নাম (বাংলা) — ঐচ্ছিক" name="projectNameBn" onChange={handleOnChange} value={formData.projectNameBn} />
								</Col>
							</Form.Group>

							<Form.Group as={Row} className='mb-3'>
								<Form.Label column sm='4'>Share / Unit <span className='text-danger'>*</span></Form.Label>
								<Col sm='8'>
									<Form.Control type="number" placeholder="Enter share per unit" name="unitInvestmentValue" onChange={handleOnChange} value={formData.unitInvestmentValue} />
								</Col>
							</Form.Group>
							<Form.Group as={Row} className='mb-3'>
								<Form.Label column sm='4'>Project Category <span className='text-danger'>*</span></Form.Label>
								<Col sm='8'>
									<Select
										id="projectCategory"
										instanceId="projectCategory"
										options={projectCategories}
										value={formData.projectCategory}
										onChange={(selectedOption: any) => setFormData({ ...formData, projectCategory: selectedOption })}
									/>
								</Col>
							</Form.Group>
							<Card className='mb-3'>
								<Card.Header className='text-center'>Investment Plan</Card.Header>
								<Card.Body>
									<Form.Group as={Row} className='mb-3'>
										<Form.Label column sm='4'>Tag Investment <span className='text-danger'>*</span></Form.Label>
										<Col sm='8'>
											<Select
												id="long-value-select"
												instanceId="long-value-select"
												options={investmentPlans}
												value={formData.investment || { label: 'Select investment plan', value: 0 }}
												onChange={(value) => setFormData({ ...formData, investment: value ? value : { label: 'Select investment plan', value: 0 } })}
												menuPosition='fixed'
											/>
										</Col>
									</Form.Group>
									<Form.Group as={Row} className='mb-3'>
										<Form.Label column sm='4'>Investment Type</Form.Label>
										<Col sm='8'>
											<Form.Control type="text" placeholder="Investment Type" value={formData.investment.investmentType !== undefined ? formData.investment.investmentType.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ') : ''} disabled />
										</Col>
									</Form.Group>
									<Form.Group as={Row} className='mb-3'>
										<Form.Label column sm='4'>Return Type</Form.Label>
										<Col sm='8'>
											<Form.Control type="text" placeholder="Return Type" value={formData.investment.returnType !== undefined ? formData.investment.returnType : ''} disabled />
										</Col>
									</Form.Group>
									<Form.Group as={Row} className='mb-3'>
										<Form.Label column sm='4'>Return</Form.Label>
										<Col sm='8'>
											<Row>
												<Col sm='5'>
													<Form.Control type="text" placeholder="Minimum Return" value={`${formData.investment.minimumReturn !== undefined ? formData.investment.minimumReturn : 0}%`} disabled />
												</Col>
												<Col sm='2' className='text-center'>-</Col>
												<Col sm='5'>
													<Form.Control type="text" placeholder="Maximum Return" value={`${formData.investment.maximumReturn !== undefined ? formData.investment.maximumReturn : 0}%`} disabled />
												</Col>
											</Row>
										</Col>
									</Form.Group>
									<Form.Group as={Row} className='mb-3'>
										<Form.Label column sm='4'>Tenure / Duration</Form.Label>
										<Col sm='8'>
											<Form.Control type="text" placeholder="Tenure" value={`${formData.investment.duration !== undefined ? formData.investment.duration : ''} ${formData.investment.tenure !== undefined ? formData.investment.tenure : ''}`} disabled />
										</Col>
									</Form.Group>
									<Form.Group as={Row} className='mb-3'>
										<Form.Label column sm='4'>Total Return</Form.Label>
										<Col sm='8'>
											<Row>
												<Col sm='5'>
													<Form.Control type="text" placeholder="Minimum Return" value={formData.totalReturnMin} disabled />
												</Col>
												<Col sm='2' className='text-center'>-</Col>
												<Col sm='5'>
													<Form.Control type="text" placeholder="Maximum Return" value={formData.totalReturnMax} disabled />
												</Col>
											</Row>
										</Col>
									</Form.Group>
								</Card.Body>
							</Card>
							<Form.Group as={Row} className='mb-3'>
								<Form.Label column sm='4'>Collection Starts <span className='text-danger'>*</span></Form.Label>
								<Col sm='8'>
									<Form.Control type="date" placeholder="Enter collection start date" name="collectionStarts" onChange={handleOnChange} value={formData.collectionStarts} />
								</Col>
							</Form.Group>
							<Form.Group as={Row} className='mb-3'>
								<Form.Label column sm='4'>Main Image </Form.Label>
								<Col sm='8'>
									<Form.Control type="file" onChange={handleFileUpload} ref={mainImageRef} />
								</Col>
							</Form.Group>
							{/* <Form.Group as={Row} className='mb-3'>
								<Form.Label column sm='4'>Total Available Units <span className='text-danger'>*</span></Form.Label>
								<Col sm='8'>
									<Form.Control type="number" placeholder="Enter total available units" name="totalAvailableUnits" onChange={handleOnChange} value={formData.totalAvailableUnits} />
								</Col>
							</Form.Group> */}
							<Form.Group as={Row} className='mb-3'>
								<Form.Label column sm='4'>Investor Unit Capacity</Form.Label>
								<Col sm='8'>
									<Form.Control type="number" placeholder="Enter investor unit capacity" name="investorUnitCapacity" onChange={handleOnChange} value={formData.investorUnitCapacity} />
								</Col>
							</Form.Group>
						</Col>
						<Col md={6}>
							<Form.Group as={Row} className='mb-3'>
								<Form.Label column sm='4'>Location <span className='text-danger'>*</span></Form.Label>
								<Col sm='8'>
									<Form.Control type="text" placeholder="Enter project location" name="location" onChange={handleOnChange} value={formData.location} />
									{/* Bangla counterpart — optional; blank falls back to English. */}
									<Form.Control className="mt-2" type="text" lang="bn" placeholder="প্রকল্পের অবস্থান (বাংলা) — ঐচ্ছিক" name="locationBn" onChange={handleOnChange} value={formData.locationBn} />
								</Col>
							</Form.Group>
							<Form.Group as={Row} className='mb-3'>
								<Form.Label column sm='4'>Other Locations </Form.Label>
								<Col sm='8'>
									<Form.Control type="text" placeholder="Enter your projects other location" name="otherLocations" onChange={handleOnChange} value={formData.otherLocations} />
									{/* Bangla counterpart — optional; blank falls back to English. */}
									<Form.Control className="mt-2" type="text" lang="bn" placeholder="অন্যান্য অবস্থান (বাংলা) — ঐচ্ছিক" name="otherLocationsBn" onChange={handleOnChange} value={formData.otherLocationsBn} />
								</Col>
							</Form.Group>
							<Form.Group as={Row} className='mb-3'>
								<Form.Label column sm='4'>Summary</Form.Label>
								<Col sm='8'>
									<Editor
										apiKey="abqylwi3epqtdz7e4t0aasmr5f62etpkkrrd9kiuktqf004r"
										onInit={(evt, editor) => editorRef.current = editor}
										id='summary'
										init={{
											height: 400,
											plugins: [
												'advlist', 'autolink', 'lists', 'link', 'image', 'charmap', 'preview',
												'anchor', 'searchreplace', 'visualblocks', 'code', 'fullscreen',
												'insertdatetime', 'media', 'table', 'help', 'wordcount'
											],
											toolbar: 'undo redo | blocks | ' +
												'bold italic backcolor | alignleft aligncenter ' +
												'alignright alignjustify | bullist numlist outdent indent | ' +
												'removeformat | help',
											content_style: 'body { font-family:Helvetica,Arial,sans-serif; font-size:16px }'
										}}
									/>
								</Col>
							</Form.Group>
							<Form.Group as={Row} className='mb-3'>
								{/* Bangla summary. Optional — blank falls back to the English
									summary. Own editor instance, Bangla-capable font stack. */}
								<Form.Label column sm='4'>Summary (বাংলা)</Form.Label>
								<Col sm='8'>
									<Editor
										apiKey="abqylwi3epqtdz7e4t0aasmr5f62etpkkrrd9kiuktqf004r"
										onInit={(evt, editor) => summaryBnRef.current = editor}
										id='summaryBn'
										init={{
											height: 400,
											plugins: [
												'advlist', 'autolink', 'lists', 'link', 'image', 'charmap', 'preview',
												'anchor', 'searchreplace', 'visualblocks', 'code', 'fullscreen',
												'insertdatetime', 'media', 'table', 'help', 'wordcount'
											],
											toolbar: 'undo redo | blocks | ' +
												'bold italic backcolor | alignleft aligncenter ' +
												'alignright alignjustify | bullist numlist outdent indent | ' +
												'removeformat | help',
											content_style: 'body { font-family:"Noto Sans Bengali","Nirmala UI",Helvetica,Arial,sans-serif; font-size:16px; line-height:1.7 }'
										}}
									/>
									<Form.Text muted>Optional. Falls back to the English summary if left blank.</Form.Text>
								</Col>
							</Form.Group>
							<Form.Group as={Row} className='mb-3'>
								<Form.Label column sm='4'>Collection Ends <span className='text-danger'>*</span></Form.Label>
								<Col sm='8'>
									<Form.Control type="date" placeholder="Enter collection end date" name="collectionEnds" onChange={handleOnChange} value={formData.collectionEnds} />
								</Col>
							</Form.Group>
							<Form.Group as={Row} className='mb-3'>
								<Form.Label column sm='4'>Featured Images</Form.Label>
								<Col sm='8'>
									<Form.Control type="file" multiple onChange={handleFeatureImageUpload} ref={featuredImagesRef} />
								</Col>
							</Form.Group>
							<Form.Group as={Row} className='mb-3'>
								<Form.Label column sm='4'>Show in upcoming</Form.Label>
								<Col sm='8'>
									<Select
										id="showInUpcoming"
										instanceId="showInUpcoming"
										options={[
											{ value: 'no', label: 'No' },
											{ value: 'yes', label: 'Yes' }
										]}
										value={{ value: formData.showInUpcoming, label: formData.showInUpcoming === 'yes' ? 'Yes' : 'No' }}
										onChange={(selectedOption: any) => setFormData({ ...formData, showInUpcoming: selectedOption.value })}
									/>
								</Col>
							</Form.Group>
							<Form.Group as={Row} className='mb-3'>
								<Form.Label column sm='4'>Project type</Form.Label>
								<Col sm='8'>
									<Select options={[
										{ value: 'regular', label: 'Regular' },
										{ value: 'special', label: 'Special' },
									]} value={{ value: formData.projectType, label: formData.projectType === 'regular' ? 'Regular' : 'Special' }} onChange={(selectedOption: any) => setFormData({ ...formData, projectType: selectedOption.value })} />
								</Col>
							</Form.Group>
							{formData.projectType === 'special' && <Card className='mb-3'>
								<Card.Header className='text-center'>Special project property</Card.Header>
								<Card.Body>
									<Form.Group as={Row} className='mb-3'>
										<Form.Label column sm='4'>Cattle Live Weight Rate</Form.Label>
										<Col sm='8'>
											<Form.Control type="number" placeholder="Enter cattle live weight rate" name="cattleLiveWeightRate" onChange={(e) => setFormData({ ...formData, ProjectProperty: { ...formData.ProjectProperty, cattleLiveWeightRate: Number(e.target.value) } })} value={formData.ProjectProperty.cattleLiveWeightRate} />
										</Col>
									</Form.Group>
									<Form.Group as={Row} className='mb-3'>
										<Form.Label column sm='4'>Cattle Initial Weight</Form.Label>
										<Col sm='8'>
											<Row>
												<Col sm='5'>
													<Form.Control type="number" placeholder="Minimum weight" name="cattleInitialWeightMin" onChange={(e) => setFormData({ ...formData, ProjectProperty: { ...formData.ProjectProperty, cattleInitialWeightMin: Number(e.target.value) } })} value={formData.ProjectProperty.cattleInitialWeightMin} />
												</Col>
												<Col sm='2' className='text-center'>-</Col>
												<Col sm='5'>
													<Form.Control type="number" placeholder="Maximum weight" name="cattleInitialWeightMax" onChange={(e) => setFormData({ ...formData, ProjectProperty: { ...formData.ProjectProperty, cattleInitialWeightMax: Number(e.target.value) } })} value={formData.ProjectProperty.cattleInitialWeightMax} />
												</Col>
											</Row>
										</Col>
									</Form.Group>
									<Form.Group as={Row} className='mb-3'>
										<Form.Label column sm='4'>Cattle Final Weight</Form.Label>
										<Col sm='8'>
											<Row>
												<Col sm='5'>
													<Form.Control type="number" placeholder="Minimum weight" name="cattleFinalWeightMin" onChange={(e) => setFormData({ ...formData, ProjectProperty: { ...formData.ProjectProperty, cattleFinalWeightMin: Number(e.target.value) } })} value={formData.ProjectProperty.cattleFinalWeightMin} />
												</Col>
												<Col sm='2' className='text-center'>-</Col>
												<Col sm='5'>
													<Form.Control type="number" placeholder="Maximum weight" name="cattleFinalWeightMax" onChange={(e) => setFormData({ ...formData, ProjectProperty: { ...formData.ProjectProperty, cattleFinalWeightMax: Number(e.target.value) } })} value={formData.ProjectProperty.cattleFinalWeightMax} />
												</Col>
											</Row>
										</Col>
									</Form.Group>
								</Card.Body>
							</Card>
							}
						</Col>
					</Row>
					<Row className='justify-content-center'>
						<Button className='w-25' variant="primary" type="submit" disabled={loading}>
							{loading && <Spinner as="span" animation="grow" size="sm" role="status" aria-hidden="true" />}
							{loading ? 'Submitting...' : 'Submit'}
						</Button>
					</Row>
				</Form>
				{/* {<pre>{JSON.stringify(formData, null, 2)}</pre>} */}
			</Container>
		</>
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
