import React, { useState, useRef, useEffect } from 'react';
import { Button, Col, Container, Form, Row } from 'react-bootstrap';
import { API_URL } from '@/config/constants';
import { Editor } from '@tinymce/tinymce-react';
import MainLayout from '@/layouts/MainLayout';
import Select from 'react-select';
import Swal from 'sweetalert2';
import { getCookie } from '@/utils/GetCookie';

interface FormDataType {
    name: string,
    phoneNumber: number,
    age: number,
    location: string,
    role: string,
    bio: string,
    interestedIn: string,
    joiningDate: string,
    multiSkills: any[],
    education: string,
    skills: string,
    profilePicture: any
    featuredImages: any
}

interface Skills {
    value: number;
    label: string;
}

function Registration() {
    const [formData, setFormData] = useState<FormDataType>({
        name: '',
        phoneNumber: 0,
        age: 0,
        location: '',
        role: '',
        bio: '',
        interestedIn: '',
        joiningDate: '',
        multiSkills: [],
        education: '',
        skills: '',
        profilePicture: '',
        featuredImages: ''
    });
    const bioRef = useRef<any>(null);
    const [skills, setSkills] = useState<Skills[]>([]);

    useEffect(() => {
        const fetchSkills = async () => {
            try {
                const res = await fetch(API_URL + 'api/all_skills');
                const data = await res.json();
                if (res.status === 200) {
                    setSkills(data);
                } else {
                    console.log('Failed to fetch skills');
                }
            } catch (err) {
                console.log(err);
            }
        };
        fetchSkills();
    }, []);

    const handleOnChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSkillsChange = (selectedOption: any) => {
        setFormData({
            ...formData,
            multiSkills: selectedOption,
            skills: selectedOption.map((item: any) => item.label).join(','),
        });
    };

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            const fileType = file.type;
            const validImageTypes = ['image/jpeg', 'image/png', 'image/jpg'];
            if (validImageTypes.includes(fileType)) {
                setFormData({ ...formData, profilePicture: file });
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
            text: "You want to register this partner!",
            icon: 'warning',
            showCancelButton: true,
            cancelButtonText: 'No',
            confirmButtonText: 'Yes'
        }).then((result) => {
            if (result.value) {
                const newFormData = new FormData();
                newFormData.append('name', formData.name);
                newFormData.append('phoneNumber', formData.phoneNumber.toString());
                newFormData.append('age', formData.age.toString());
                newFormData.append('location', formData.location);
                newFormData.append('role', formData.role);
                newFormData.append('bio', bioRef.current.getContent());
                newFormData.append('interestedIn', formData.interestedIn);
                newFormData.append('joiningDate', formData.joiningDate);
                newFormData.append('skills', formData.skills);
                newFormData.append('education', formData.education);
                newFormData.append('profilePicture', formData.profilePicture);
                if (formData.featuredImages) {
                    for (let i = 0; i < formData.featuredImages.length; i++) {
                        newFormData.append('featuredImages', formData.featuredImages[i]);
                    }
                }
                try {
                    const fetchData = async () => {
                        const res = await fetch(API_URL + 'api/partners/registration', {
                            method: 'POST',
                            headers: { 'Authorization': 'Bearer ' + getCookie('saathi-token') },
                            body: newFormData,
                        });
                        if (res.status === 200) {
                            Swal.fire({
                                icon: 'success',
                                title: 'Success',
                                text: 'Partner successfully registered!',
                            });
                            setFormData({
                                name: '',
                                phoneNumber: 0,
                                age: 0,
                                location: '',
                                role: '',
                                bio: '',
                                interestedIn: '',
                                joiningDate: '',
                                multiSkills: [],
                                education: '',
                                skills: '',
                                profilePicture: '',
                                featuredImages: ''
                            });
                            bioRef.current.setContent('');

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
    };

    return (
        <>
            <Container>
                <h2 className="text-center">Partner Registration</h2>
                <hr />
                <Form onSubmit={handleSubmit}>
                    <Row>
                        <Col md={6}>
                            <Form.Group as={Row} className='mb-3'>
                                <Form.Label column sm='4'>Name <span className='text-danger'>*</span></Form.Label>
                                <Col sm='8'>
                                    <Form.Control
                                        type="text"
                                        placeholder="Enter your full name"
                                        name="name"
                                        onChange={handleOnChange}
                                        value={formData.name}

                                    />
                                </Col>
                            </Form.Group>

                            <Form.Group as={Row} className='mb-3'>
                                <Form.Label column sm='4'>Age <span className='text-danger'>*</span></Form.Label>
                                <Col sm='8'>
                                    <Form.Control
                                        type="number"
                                        placeholder="Enter your age"
                                        name="age"
                                        onChange={handleOnChange}
                                        value={formData.age}
                                    />
                                </Col>
                            </Form.Group>
                            <Form.Group as={Row} className='mb-3'>
                                <Form.Label column sm='4'>Role <span className='text-danger'>*</span></Form.Label>
                                <Col sm='8'>
                                    <Form.Control
                                        type="text"
                                        placeholder="Enter your role"
                                        name="role"
                                        onChange={handleOnChange}
                                        value={formData.role}
                                    />
                                </Col>
                            </Form.Group>

                            <Form.Group as={Row} className='mb-3'>
                                <Form.Label column sm='4'>Skills <span className='text-danger'>*</span></Form.Label>
                                <Col sm='8'>
                                    <Select
                                        id="long-value-select"
                                        instanceId="long-value-select"
                                        options={skills}
                                        value={formData.multiSkills}
                                        onChange={handleSkillsChange}
                                        menuPosition='fixed'
                                        isMulti
                                    />
                                </Col>
                            </Form.Group>
                            <Form.Group as={Row} className='mb-3'>
                                <Form.Label column sm='4'>Education</Form.Label>
                                <Col sm='8'>
                                    <Form.Control
                                        type='text'
                                        placeholder="Enter your last degree"
                                        name="education"
                                        onChange={handleOnChange}
                                        value={formData.education}
                                    />
                                </Col>
                            </Form.Group>
                            <Form.Group as={Row} className='mb-3'>
                                <Form.Label column sm='4'>Profile Picture </Form.Label>
                                <Col sm='8'>
                                    <Form.Control type="file" onChange={handleFileUpload} />
                                </Col>
                            </Form.Group>
                            <Form.Group as={Row} className='mb-3'>
                                <Form.Label column sm='4'>Featured Images</Form.Label>
                                <Col sm='8'>
                                    <Form.Control type="file" multiple onChange={handleFeatureImageUpload} />
                                </Col>
                            </Form.Group>
                        </Col>
                        <Col sm={6}>
                            <Form.Group as={Row}>
                                <Form.Label column sm='4' className='mb-3'>Phone Number <span className='text-danger'>*</span></Form.Label>
                                <Col sm='8'>
                                    <Form.Control
                                        type="number"
                                        placeholder="Enter your phone number"
                                        name="phoneNumber"
                                        onChange={handleOnChange}
                                        value={formData.phoneNumber}
                                    />
                                </Col>
                            </Form.Group>
                            <Form.Group as={Row} className='mb-3'>
                                <Form.Label column sm='4'>Interested In</Form.Label>
                                <Col sm='8'>
                                    <Form.Control
                                        type='text'
                                        placeholder="Enter your interested projects"
                                        name="interestedIn"
                                        onChange={handleOnChange}
                                        value={formData.interestedIn}
                                    />
                                </Col>
                            </Form.Group>

                            <Form.Group as={Row} className='mb-3'>
                                <Form.Label column sm='4'>Joining Date <span className='text-danger'>*</span></Form.Label>
                                <Col sm='8'>
                                    <Form.Control
                                        type='date'
                                        name="joiningDate"
                                        onChange={handleOnChange}
                                        value={formData.joiningDate}
                                    />
                                </Col>
                            </Form.Group>
                            <Form.Group as={Row} className='mb-3'>
                                <Form.Label column sm='4'>Location / Address <span className='text-danger'>*</span></Form.Label>
                                <Col sm='8'>
                                    <Form.Control
                                        as="textarea"
                                        placeholder="Enter your current location/address"
                                        name="location"
                                        onChange={handleOnChange}
                                        rows={2}
                                        value={formData.location}
                                    />
                                </Col>
                            </Form.Group>
                            <Form.Group as={Row} className='mb-3'>
                                <Form.Label column sm='4'>Bio</Form.Label>
                                <Col sm='8' style={{ zIndex: '0' }}>
                                    <Editor
                                        apiKey="27k7mo6dhwbg8ogpsyq0gfjtfd4d5682zmurtqp44ean979x"
                                        onInit={(evt, editor) => bioRef.current = editor}
                                        id='painPoints'
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
                        </Col>
                        {/* <pre>{JSON.stringify(formData, null, 2)}</pre> */}
                    </Row>
                    <Row className='justify-content-center'>
                        <Button className='w-50' variant="primary" type="submit">
                            Submit
                        </Button>
                    </Row>
                </Form>
            </Container>
        </>
    );
}

export default Registration;

Registration.getLayout = function PageLayout(page: any) {
    return (
        <MainLayout>
            {page}
        </MainLayout>
    )
}
