import React, { useState, useRef, useContext } from 'react';
import MainLayout from '@/layouts/MainLayout';
import { Container, Row, Col, Form, Button, Spinner } from 'react-bootstrap';
import { Editor } from '@tinymce/tinymce-react';
import { API_URL } from '@/config/constants';
import Swal from 'sweetalert2';
import { getCookie } from '@/utils/GetCookie';
import { AppContext } from '@/context/AppContext';

interface FormDataType {
    createdBy?: number;
    sendViaSms: string;
    smsBody: string;
    sendViaEmail: string;
    emailSubject: string;
    emailBody: string;
    sendViaPush: string;
    pushNotificationTitle: string;
    pushNotificationBody: string;
    pushNotificationImage: File | null;
}

function ManualNotification() {
    const { token, currentUser } = useContext(AppContext);
    const [formData, setFormData] = useState<FormDataType>({
        sendViaSms: 'no',
        smsBody: '',
        sendViaEmail: 'no',
        emailSubject: '',
        emailBody: '',
        sendViaPush: 'no',
        pushNotificationTitle: '',
        pushNotificationBody: '',
        pushNotificationImage: null
    });
    const editorRef = useRef<any>(null);
    const [loading, setLoading] = useState<boolean>(false);

    const handleTextChange = (e: any) => {
        const { name, value } = e.target;
        setFormData({
            ...formData,
            [name]: value
        });
    }

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setLoading(true);
        Swal.fire({
            title: 'Are you sure?',
            text: "You want to create this manual notification!",
            icon: 'warning',
            showCancelButton: true,
            cancelButtonText: 'No',
            confirmButtonText: 'Yes'
        }).then(async (result) => {
            if (result.value) {
                try {
                    formData.createdBy = currentUser?.idUsers || undefined;
                    const newFormData = new FormData();
                    newFormData.append('createdBy', formData.createdBy?.toString() || '');
                    newFormData.append('sendViaSms', formData.sendViaSms);
                    newFormData.append('smsBody', formData.smsBody);
                    newFormData.append('sendViaEmail', formData.sendViaEmail);
                    newFormData.append('emailSubject', formData.emailSubject);

                    if (editorRef.current !== null) {
                        newFormData.append('emailBody', editorRef.current.getContent());
                    } else {
                        newFormData.append('emailBody', formData.emailBody);
                    }

                    newFormData.append('sendViaPush', formData.sendViaPush);
                    newFormData.append('pushNotificationTitle', formData.pushNotificationTitle);
                    newFormData.append('pushNotificationBody', formData.pushNotificationBody);

                    if (formData.pushNotificationImage) {
                        newFormData.append('pushNotificationImage', formData.pushNotificationImage);
                    }
                    const res = await fetch(API_URL + 'api/manual-notification/create', {
                        method: 'POST',
                        headers: { 'Authorization': 'Bearer ' + getCookie('saathi-token') },
                        body: newFormData,
                    });
                    if (res.status === 200) {
                        Swal.fire({
                            icon: 'success',
                            title: 'Success',
                            text: 'Manual notification created successfully!',
                        });
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
                <Row className="justify-content-center">
                    <Col md={6}>
                        <h4 className="text-start">Manual Notification Create</h4>
                        <hr />
                        <Form onSubmit={handleSubmit}>
                            <Form.Group as={Row}>
                                <Form.Label column sm='4' className='mb-3'>Send Via Sms<span className='text-danger'>*</span></Form.Label>
                                <Col sm='8'>
                                    <Form.Select name='sendViaSms' onChange={handleTextChange} value={formData.sendViaSms}>
                                        <option>Select Option</option>
                                        <option value="yes">Yes</option>
                                        <option value="no">No</option>
                                    </Form.Select>
                                </Col>
                            </Form.Group>
                            {formData.sendViaSms === 'yes' &&
                                <Form.Group as={Row}>
                                    <Form.Label column sm='4' className='mb-3'>Sms Body<span className='text-danger'>*</span></Form.Label>
                                    <Col sm='8'>
                                        <Form.Control as='textarea' name='smsBody' value={formData.smsBody} onChange={handleTextChange} />
                                    </Col>
                                </Form.Group>
                            }
                            <Form.Group as={Row} className='mt-2'>
                                <Form.Label column sm='4' className='mb-3'>Send Via Email<span className='text-danger'>*</span></Form.Label>
                                <Col sm='8'>
                                    <Form.Select name='sendViaEmail' onChange={handleTextChange} value={formData.sendViaEmail}>
                                        <option>Select Option</option>
                                        <option value="yes">Yes</option>
                                        <option value="no">No</option>
                                    </Form.Select>
                                </Col>
                            </Form.Group>
                            {formData.sendViaEmail === 'yes' &&
                                <>
                                    <Form.Group as={Row} className='mb-3'>
                                        <Form.Label column sm='4' className='mb-3'>Email Subject<span className='text-danger'>*</span></Form.Label>
                                        <Col sm='8'>
                                            <Form.Control type='text' name='emailSubject' value={formData.emailSubject} onChange={handleTextChange} />
                                        </Col>
                                    </Form.Group>
                                    <Form.Group as={Row} className='mb-3'>
                                        <Form.Label column sm='4' className='mb-3'>Email Body<span className='text-danger'>*</span></Form.Label>
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
                                </>
                            }
                            <Form.Group as={Row}>
                                <Form.Label column sm='4' className='mb-3'>Send Via Push<span className='text-danger'>*</span></Form.Label>
                                <Col sm='8'>
                                    <Form.Select name='sendViaPush' onChange={handleTextChange} value={formData.sendViaPush}>
                                        <option>Select Option</option>
                                        <option value="yes">Yes</option>
                                        <option value="no">No</option>
                                    </Form.Select>
                                </Col>
                            </Form.Group>
                            {formData.sendViaPush === 'yes' &&
                                <>
                                    <Form.Group as={Row} className='mb-3'>
                                        <Form.Label column sm='4' className='mb-3'>Push Notification Title<span className='text-danger'>*</span></Form.Label>
                                        <Col sm='8'>
                                            <Form.Control type='text' name='pushNotificationTitle' value={formData.pushNotificationTitle} onChange={handleTextChange} />
                                        </Col>
                                    </Form.Group>
                                    <Form.Group as={Row} className='mb-3'>
                                        <Form.Label column sm='4' className='mb-3'>Push Notification Body<span className='text-danger'>*</span></Form.Label>
                                        <Col sm='8'>
                                            <Form.Control as='textarea' name='pushNotificationBody' value={formData.pushNotificationBody} onChange={handleTextChange} />
                                        </Col>
                                    </Form.Group>
                                    <Form.Group as={Row} className='mb-3'>
                                        <Form.Label column sm='4' className='mb-3'>Push Notification Image</Form.Label>
                                        <Col sm='8'>
                                            <Form.Control type='file' name='pushNotificationImage' onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                                if (e.target.files && e.target.files[0]) {
                                                    setFormData({
                                                        ...formData,
                                                        pushNotificationImage: e.target.files[0]
                                                    });
                                                }
                                            }} />
                                        </Col>
                                    </Form.Group>

                                </>
                            }
                            <Row>
                                <Col sm='4'></Col>
                                <Col sm='8'>
                                    <Row className='justify-content-center'>
                                        <Button className='w-50' variant="primary" type="submit" disabled={loading}>
                                            {loading && <Spinner as="span" animation="grow" size="sm" role="status" aria-hidden="true" />}
                                            {loading ? 'Submitting...' : 'Submit'}
                                        </Button>
                                    </Row>
                                </Col>
                            </Row>
                        </Form>
                    </Col>
                </Row>
                {/* <pre>{JSON.stringify(formData, null, 2)}</pre> */}
            </Container>
        </>
    )
}

export default ManualNotification;

ManualNotification.getLayout = function PageLayout(page: any) {
    return (
        <MainLayout>
            {page}
        </MainLayout>
    )
}