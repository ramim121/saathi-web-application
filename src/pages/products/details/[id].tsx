/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useEffect, useRef } from "react";
import MainLayout from "@/layouts/MainLayout";
import { useRouter } from "next/router";
import { getRequestOptions } from "@/utils/Fetch";
import { Container, Row, Table, Col, Tab, Tabs, Form, Button } from "react-bootstrap";
import Swal from "sweetalert2";
import { API_URL } from '@/config/constants';
import { getCookie } from '@/utils/GetCookie';
import { S3_URL } from '@/config/constants';

interface DetailsProps {

    idProducts: number,
    productName: string,
    idProductCategories: number,
    idUnit: number,
    productDescription: string,
    ProductCategory: {
        idProductCategories: number,
        productCategoryName: string
    },
    Unit: {
        idUnit: number,
        unitName: string
    },
    ProductImages: {
        idProductImages: number,
        imageName: string,
        imageNameOriginal: string,
        imageStatus: string
    }[]
}

function Details() {
    const router = useRouter();
    const { id } = router.query;
    const [details, setDetails] = useState<DetailsProps>({} as DetailsProps);
    const [images, setImages] = useState<any>('');
    const fileRef = useRef<HTMLInputElement>(null);
    const [reload, setReload] = useState<boolean>(false);

    useEffect(() => {
        if (id != undefined) {
            fetchProductDetails();
        }
    }, [id])

    useEffect(() => {
        if (reload) {
            fetchProductDetails();
        }
    }, [reload])

    const fetchProductDetails = async () => {
        setReload(true);
        try {
            const res = await fetch('/api/products/details/' + id, getRequestOptions());
            const data = await res.json();
            if (res.status === 200) {
                setDetails(data.data);
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
        setReload(false);
    }

    const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
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
                setImages(files);
            }
        }
    }

    const handleImageUpload = async (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
        e.preventDefault();
        if (images === '') {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Please select a file to upload!',
            });
            return;
        }

        Swal.fire({
            title: 'Are you sure?',
            text: 'Do you want to upload this images?',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Yes',
            cancelButtonText: 'No',
            showLoaderOnConfirm: true,
            allowOutsideClick: false,
            preConfirm: async () => {
                const formData = new FormData();
                if (id) {
                    formData.append('idProducts', id.toString());
                } else {
                    throw new Error('Product ID is undefined');
                }
                if (images && images.length > 0) {
                    for (let i = 0; i < images.length; i++) {
                        formData.append('productImages', images[i]);
                    }
                }
                try {
                    const response = await fetch(API_URL + 'api/products/images_upload', {
                        method: 'POST',
                        headers: { 'Authorization': 'Bearer ' + getCookie('saathi-token') },
                        body: formData,
                    });

                    if (response.ok) {
                        Swal.fire({
                            icon: 'success',
                            title: 'Success',
                            text: 'Images uploaded successfully!',
                        });
                        fileRef.current!.value = '';
                        setReload(true);
                    } else {
                        Swal.fire({
                            icon: 'error',
                            title: 'Error',
                            html: (await response.json()).message,
                        });
                    }
                } catch (error) {
                    Swal.fire({
                        icon: 'error',
                        title: 'Error',
                        text: (error as Error).message,
                    });
                }
            },
        });
    };

    return (
        <Container>
            <h4 className="text-start"> Product Details ({details?.productName})</h4>
            <hr />
            <Tabs defaultActiveKey="details" id="uncontrolled-tab-example" className="mb-3">
                <Tab eventKey="details" title="Details">
                    <Row>
                        <Col md={6}>
                            <Table bordered>
                                <tbody>
                                    <tr>
                                        <td>Product Name</td>
                                        <td>{details?.productName}</td>
                                    </tr>
                                    <tr>
                                        <td>Product Category</td>
                                        <td>{details?.ProductCategory?.productCategoryName}</td>
                                    </tr>
                                    <tr>
                                        <td>Unit</td>
                                        <td>{details?.Unit?.unitName}</td>
                                    </tr>
                                    <tr>
                                        <td>Product Description</td>
                                        <td>{details?.productDescription}</td>
                                    </tr>
                                </tbody>
                            </Table>
                        </Col>
                    </Row>
                </Tab>
                <Tab eventKey="images" title="Images">
                    <Row>
                        <Col md={2}></Col>
                        <Col md={8}>
                            <Form.Group controlId="formFile" className="mb-3">
                                <Form.Control type="file" ref={fileRef} multiple={true} onChange={handleImageChange} />
                                <div className="d-flex justify-content-center">

                                    <Button className='btn btn-primary btn-sm text-light w-50 mt-2' onClick={handleImageUpload}>
                                        Upload
                                    </Button>
                                </div>
                            </Form.Group>
                        </Col>
                        <Col md={2}></Col>
                    </Row>
                    <Row>
                        <Table bordered responsive>
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>Image</th>
                                    <th>Name</th>
                                    <th>Status</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {details.ProductImages?.map((image, index) => (
                                    <tr key={index}>
                                        <td>{index + 1}</td>
                                        <td>
                                            <img src={`${S3_URL}product-image/${id}/${image.imageName}`} alt={image.imageName} style={{ width: '100px', height: '100px' }} />
                                        </td>
                                        <td>{image.imageNameOriginal}</td>
                                        <td>
                                            {image.imageStatus?.charAt(0).toUpperCase() + image.imageStatus?.slice(1)}
                                        </td>
                                        <td>
                                            <Button
                                                variant="success"
                                                size="sm"
                                                onClick={() => window.open(`${S3_URL}product-image/${id}/${image.imageName}`, '_blank')}
                                            >
                                                Download
                                            </Button>

                                        </td>

                                    </tr>
                                ))}
                            </tbody>
                        </Table>
                    </Row>
                </Tab>
            </Tabs>
        </Container>
    );
}

export default Details;

Details.getLayout = function PageLayout(page: any) {
    return (
        <MainLayout>
            {page}
        </MainLayout>
    )
}
