import React, { useEffect, useState, useRef, useContext } from 'react';
import { useRouter } from 'next/router';
import { Button, Col, Container, Form, Row, Card, Spinner, Tab, Tabs, Table } from 'react-bootstrap';
import { API_URL } from '@/config/constants';
import MainLayout from '@/layouts/MainLayout';
import Select from 'react-select';
import { Editor } from '@tinymce/tinymce-react';
import { AppContext } from '@/context/AppContext';
import Swal from 'sweetalert2';
import { getCookie } from '@/utils/GetCookie';
import { getRequestOptions } from "@/utils/Fetch";
import Image from "next/image";
import { S3_URL } from '@/config/constants';

interface FormDataType {
	projectName: string,
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
	const { token, currentUser } = useContext(AppContext);
	const [formData, setFormData] = useState<FormDataType>({
		projectName: '',
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
		projectCategory: {
			label: 'Select project category',
			value: 0
		}
	});
	const [projectCategories, setProjectCategories] = useState<ProjectCategory[]>([]);
	const editorRef = useRef<any>(null);
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
						showInUpcoming: project.showInUpcoming,
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
					if (project.summary !== null) {
						editorRef.current.setContent(project.summary);
					}
					else {
						editorRef.current.setContent(null);
					}
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
					newFormData.append('showInUpcoming', formData.showInUpcoming || 'no');
					newFormData.append('projectCategory', formData.projectCategory.value.toString());
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

	return (
		<>
			<Container>
				<h4 className="text-start">Project Edit</h4>
				<hr />
				<Form onSubmit={handleSubmit}>
					<Tabs defaultActiveKey="details" id="uncontrolled-tab-example" className="mb-3">
						<Tab eventKey="details" title="Details">
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
											<Form.Control type="number" placeholder="Enter share per unit" name="unitInvestmentValue" onChange={handleOnChange} value={formData.unitInvestmentValue} disabled />
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
												<Form.Label column sm='4'>Investment Type</Form.Label>
												<Col sm='8'>
													<Form.Control type="text" placeholder="Investment Type" value={formData?.investment?.investmentType !== undefined ? formData.investment.investmentType.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ') : ''} disabled />
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
												apiKey="abqylwi3epqtdz7e4t0aasmr5f62etpkkrrd9kiuktqf004r"
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

						</Tab>
						<Tab eventKey="images" title="Images">
							<Row>
								<Col md={6}>
									<Card className='mb-3'>
										<Card.Header className='text-center'>Main Image</Card.Header>
										<Card.Body>
											<Form.Group as={Row} className='mb-3'>
												<Col sm='12'>
													<Form.Control type="file" onChange={handleFileUpload} ref={mainImageRef} />
												</Col>
											</Form.Group>
											{(formData.mainImage !== undefined || formData.mainImage !== null) && (
												<>
													{formData.mainImage?.idFiles !== undefined ? (
														<Image
															src={`${S3_URL}project-main-image/${id}/${formData.mainImage?.fileName}`}
															alt={formData.mainImage?.originalFileName}
															width={100}
															height={100}
														/>
													) : (
														formData.mainImage && formData.mainImage instanceof File && (
															<Image
																src={URL.createObjectURL(formData.mainImage)}
																alt={formData.mainImage.name}
																width={100}
																height={100}
															/>
														)
													)}
												</>
											)}
										</Card.Body>
									</Card>
								</Col>
								<Col md={6}>
									<Card className='mb-3'>
										<Card.Header className='text-center'>Featured Images</Card.Header>
										<Card.Body>
											<Form.Group as={Row} className='mb-3'>
												<Col sm='12'>
													<Form.Control type="file" multiple onChange={handleFeatureImageUpload} ref={featuredImagesRef} />
												</Col>
											</Form.Group>
											<Table bordered>
												<thead>
													<tr>
														<th>#</th>
														<th>Image</th>
														<th>Action</th>
													</tr>
												</thead>
												<tbody>
													{formData.featuredImages?.map((image: any, index: number) => (
														<tr key={index}>
															<td>{index + 1}</td>
															<td>
																{image.idFiles !== undefined ? <a href={`${S3_URL}project-featured-image/${id}/${image.fileName}`} target="_blank" rel="noopener noreferrer">{image.originalFileName}</a> : <a href={URL.createObjectURL(image)} target="_blank" rel="noopener noreferrer">{image.name}</a>}
															</td>
															<td>
																<Button variant="danger" size="sm" onClick={() => {
																	setFormData(prevFormData => ({
																		...prevFormData,
																		featuredImages: prevFormData.featuredImages?.filter((img: any, i: number) => i !== index)
																	}));
																}}>Remove</Button>

															</td>
														</tr>
													))}
												</tbody>
											</Table>
										</Card.Body>
									</Card>
								</Col>
							</Row>
						</Tab>
					</Tabs>
					<Row className='justify-content-center'>
						<Button className='w-25' variant="primary" type="submit" disabled={loading}>
							{loading && <Spinner as="span" animation="grow" size="sm" role="status" aria-hidden="true" />}
							{loading ? 'Submitting...' : 'Submit'}
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