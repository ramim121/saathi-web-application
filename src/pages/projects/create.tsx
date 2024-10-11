import React, { useEffect, useState, useRef, useContext } from 'react';
import { Button, Col, Container, Form, Row, Card } from 'react-bootstrap';
import { API_URL } from '@/config/constants';
import MainLayout from '@/layouts/MainLayout';
import Select from 'react-select';
import { Editor } from '@tinymce/tinymce-react';
import { AppContext } from '@/context/AppContext';
import Swal from 'sweetalert2';
import { getCookie } from '@/utils/GetCookie';

interface FormDataType {
	projectName: string,
	unitInvestmentValue: number,
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
}

interface InvestmentPlan {
	value: number,
	label: string
}

function Projects() {
	const { token, currentUser } = useContext(AppContext);
	const [formData, setFormData] = useState<FormDataType>({
		projectName: '',
		unitInvestmentValue: 0,
		investment: {
			label: 'Select Investment Plan',
			value: 0
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
		showInUpcoming: 'no'
	});
	const [investmentPlans, setInvestmentPlans] = useState<InvestmentPlan[]>([]);
	const editorRef = useRef<any>(null);

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
		Swal.fire({
			title: 'Are you sure?',
			text: "You want to create this project!",
			icon: 'warning',
			showCancelButton: true,
			cancelButtonText: 'No',
			confirmButtonText: 'Yes'
		}).then((result) => {
			if (result.value) {
				try {
					formData.createdBy = currentUser?.idUsers || null;
					const newFormData = new FormData();
					newFormData.append('projectName', formData.projectName);
					newFormData.append('unitInvestmentValue', formData.unitInvestmentValue.toString());
					newFormData.append('summary', editorRef.current.getContent());
					newFormData.append('location', formData.location);
					newFormData.append('createdBy', formData.createdBy?.toString() || '');
					newFormData.append('totalReturnMin', formData.totalReturnMin.toString());
					newFormData.append('totalReturnMax', formData.totalReturnMax.toString());
					newFormData.append('collectionStarts', formData.collectionStarts);
					newFormData.append('collectionEnds', formData.collectionEnds);
					newFormData.append('otherLocations', formData.otherLocations);
					newFormData.append('mainImage', formData.mainImage);
					newFormData.append('investment', JSON.stringify(formData.investment));
					newFormData.append('showInUpcoming', formData.showInUpcoming || 'no');
					if (formData.featuredImages) {
						for (let i = 0; i < formData.featuredImages.length; i++) {
							newFormData.append('featuredImages', formData.featuredImages[i]);
						}
					}

					const fetchData = async () => {
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
							setFormData({
								projectName: '',
								unitInvestmentValue: 0,
								investment: {
									label: 'Select Investment Plan',
									value: 0
								},
								summary: '',
								location: '',
								createdBy: currentUser?.idUsers || null,
								totalReturnMin: 0,
								totalReturnMax: 0,
								collectionStarts: '',
								collectionEnds: '',
								otherLocations: '',
								mainImage: '',
								featuredImages: '',
								showInUpcoming: 'no'
							});
							editorRef.current.setContent('');

						} else {
							Swal.fire({
								icon: 'error',
								title: 'Error',
								html: (await res.json()).message,
							});
						}
					};
					fetchData();

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
		<>
			<Container>
				<h2 className="text-center">Project Creation</h2>
				<hr />
				<Form onSubmit={handleSubmit}>
					<Row>
						<Col md={6}>
							<Form.Group as={Row} className='mb-3'>
								<Form.Label column sm='4' >Name of the project <span className='text-danger'>*</span></Form.Label>
								<Col sm='8'>
									<Form.Control type="text" placeholder="Enter name of the project" name="projectName" onChange={handleOnChange} value={formData.projectName} />
								</Col>
							</Form.Group>

							<Form.Group as={Row} className='mb-3'>
								<Form.Label column sm='4'>Share / Unit <span className='text-danger'>*</span></Form.Label>
								<Col sm='8'>
									<Form.Control type="number" placeholder="Enter share per unit" name="unitInvestmentValue" onChange={handleOnChange} value={formData.unitInvestmentValue} />
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
									<Form.Control type="file" onChange={handleFileUpload} />
								</Col>
							</Form.Group>
						</Col>
						<Col md={6}>
							<Form.Group as={Row} className='mb-3'>
								<Form.Label column sm='4'>Location <span className='text-danger'>*</span></Form.Label>
								<Col sm='8'>
									<Form.Control type="text" placeholder="Enter project location" name="location" onChange={handleOnChange} value={formData.location} />
								</Col>
							</Form.Group>
							<Form.Group as={Row} className='mb-3'>
								<Form.Label column sm='4'>Other Locations </Form.Label>
								<Col sm='8'>
									<Form.Control type="text" placeholder="Enter your projects other location" name="otherLocations" onChange={handleOnChange} value={formData.otherLocations} />
								</Col>
							</Form.Group>
							<Form.Group as={Row} className='mb-3'>
								<Form.Label column sm='4'>Summary</Form.Label>
								<Col sm='8'>
									<Editor
										apiKey="27k7mo6dhwbg8ogpsyq0gfjtfd4d5682zmurtqp44ean979x"
										onInit={(evt, editor) => editorRef.current = editor}
										id='summary'
										init={{
											height: 350,
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
								<Form.Label column sm='4'>Collection Ends <span className='text-danger'>*</span></Form.Label>
								<Col sm='8'>
									<Form.Control type="date" placeholder="Enter collection end date" name="collectionEnds" onChange={handleOnChange} value={formData.collectionEnds} />
								</Col>
							</Form.Group>
							<Form.Group as={Row} className='mb-3'>
								<Form.Label column sm='4'>Featured Images</Form.Label>
								<Col sm='8'>
									<Form.Control type="file" multiple onChange={handleFeatureImageUpload} />
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
						</Col>
					</Row>
					<Row className='justify-content-center'>
						<Button className='w-50' variant="primary" type="submit">
							Submit
						</Button>
					</Row>
				</Form>
				{/* <pre>{JSON.stringify(formData, null, 2)}</pre> */}
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