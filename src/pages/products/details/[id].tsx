/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useEffect, useRef } from "react";
import MainLayout from "@/layouts/MainLayout";
import { useRouter } from "next/router";
import { getRequestOptions, postRequestOptions } from "@/utils/Fetch";
import { Container, Row, Table, Col, Tab, Tabs, Form, Button, Spinner } from "react-bootstrap";
import Swal from "sweetalert2";
import { API_URL } from '@/config/public';
import { getCookie } from '@/utils/GetCookie';
import { S3_URL } from '@/config/public';
import Select from 'react-select';

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
    }[],
    ProductPartners: {
        idProductPartners: number,
        sellRate: number,
        User: {
            idUsers: number,
            fullName: string,
            email: string,
            phoneNumber: string,
            joiningDate: string
        },
        ProductPacking: {
            idProductPackings: number,
            packingName: string,
            size: string
        }
    }[]
    ProductPackings: {
        idProductPackings: number,
        packingName: string,
        size: string,
    }[]

}

interface PartnerProps {
    idUsers: number,
    fullName: string,
    email: string,
    phoneNumber: string,
    joiningDate: string,
}

interface PackingProps {
    idProductPackings?: number,
    packingName: string,
    size: string,
}

function Details() {
    const router = useRouter();
    const { id } = router.query;
    const [details, setDetails] = useState<DetailsProps>({} as DetailsProps);
    const [partners, setPartners] = useState<PartnerProps[]>([]);
    const [images, setImages] = useState<any>('');
    const fileRef = useRef<HTMLInputElement>(null);
    const [reload, setReload] = useState<boolean>(false);
    const [assignedPartners, setAssignedPartners] = useState<PartnerProps>({
        idUsers: 0,
        fullName: '',
        email: '',
        phoneNumber: '',
        joiningDate: ''
    });
    const [selectedPacking, setSelectedPacking] = useState<PackingProps>({} as PackingProps);
    const [sellRate, setSellRate] = useState<number>(0);
    const [loading, setLoading] = useState<boolean>(false);
    const [packing, setPacking] = useState<PackingProps>({
        packingName: '',
        size: ''
    });
    const [packingList, setPackingList] = useState<PackingProps[]>([]);

    useEffect(() => {
        if (id != undefined) {
            fetchProductDetails();
            fetchPartners();
            fetchProductPacking();
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

    const fetchPartners = async () => {
        try {
            const res = await fetch(API_URL + 'api/products/get_partner_for_assign', getRequestOptions());
            const data = await res.json();
            if (res.status === 200) {
                setPartners(data.data);
            } else {
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: data.message,
                });
            }
        } catch (err) {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Something went wrong!',
            });
        }
    };

    const fetchProductPacking = async () => {
        try {
            const res = await fetch('/api/products/get-product-packing/' + id, getRequestOptions());
            const data = await res.json();
            if (res.status === 200) {
                setPackingList(data.data);
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
                text: 'Please select a image to upload!',
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

    const handlePartnerAssign = async (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
        e.preventDefault();
        Swal.fire({
            title: 'Are you sure?',
            text: 'Do you want to assign the partner?',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Yes',
            cancelButtonText: 'No',
            showLoaderOnConfirm: true,
            allowOutsideClick: false,
            preConfirm: async () => {
                const formData = {
                    idProducts: id,
                    partners: assignedPartners,
                    sellRate: sellRate,
                    packing: selectedPacking
                }
                try {
                    setLoading(true);
                    const response = await fetch(API_URL + 'api/products/assign_partners', postRequestOptions(formData));

                    if (response.ok) {
                        Swal.fire({
                            icon: 'success',
                            title: 'Success',
                            text: 'Partner assigned successfully!',
                        });
                        setReload(true);
                        setAssignedPartners({
                            idUsers: 0,
                            fullName: '',
                            email: '',
                            phoneNumber: '',
                            joiningDate: ''
                        });
                        setSellRate(0);
                        setSelectedPacking({} as PackingProps);
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
                } finally {
                    setLoading(false);
                }
            },
        });
    };

    const handlePackingSubmit = async (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
        e.preventDefault();
        Swal.fire({
            title: 'Are you sure?',
            text: 'Do you want to add this packing?',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Yes',
            cancelButtonText: 'No',
            showLoaderOnConfirm: true,
            allowOutsideClick: false,
            preConfirm: async () => {
                const formData = {
                    packingName: packing.packingName,
                    size: packing.size,
                    idProducts: id
                }
                try {
                    setLoading(true);
                    const response = await fetch(API_URL + 'api/products/add_packing', postRequestOptions(formData));

                    if (response.ok) {
                        Swal.fire({
                            icon: 'success',
                            title: 'Success',
                            text: 'Packing added successfully!',
                        });
                        setReload(true);
                        setPacking({
                            packingName: '',
                            size: ''
                        });
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
                } finally {
                    setLoading(false);
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
                <Tab eventKey="packing" title="Packing">
                    <Row>
                        <Col md={2}></Col>
                        <Col md={8}>
                            <Form>
                                <Form.Group as={Row}>
                                    <Form.Label column sm='4' className='mb-3'>Packing Name<span className='text-danger'>*</span></Form.Label>
                                    <Col sm='8'>
                                        <Form.Control type="text" placeholder="Enter packing name" name="packingName" onChange={(e) => setPacking({ ...packing, packingName: e.target.value })} value={packing.packingName} />
                                    </Col>
                                </Form.Group>
                                <Form.Group as={Row}>
                                    <Form.Label column sm='4' className='mb-3'>Size</Form.Label>
                                    <Col sm='8'>
                                        <Form.Control type="text" placeholder="Enter size" name="size" onChange={(e) => setPacking({ ...packing, size: e.target.value })} value={packing.size} />
                                    </Col>
                                </Form.Group>
                            </Form>
                        </Col>
                        <Col md={2}></Col>
                    </Row>
                    <Row>
                        <Col sm='4'></Col>
                        <Col sm='6'>
                            <Row className='justify-content-center'>
                                <Button className='w-50' variant="primary" type="submit" disabled={loading} onClick={handlePackingSubmit}>
                                    {loading && <Spinner as="span" animation="grow" size="sm" role="status" aria-hidden="true" />}
                                    {loading ? 'Submitting...' : 'Submit'}
                                </Button>
                            </Row>
                        </Col>
                    </Row>
                    <Row className='mt-3'>
                        <Table bordered responsive>
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>Packing Name</th>
                                    <th>Size</th>
                                </tr>
                            </thead>
                            <tbody>
                                {details.ProductPackings?.length > 0 ? (
                                    details.ProductPackings.map((packing, index) => (
                                        <tr key={index}>
                                            <td>{index + 1}</td>
                                            <td>{packing.packingName}</td>
                                            <td>{packing.size}</td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={3} className="text-center">No packings found</td>
                                    </tr>
                                )}
                            </tbody>
                        </Table>
                    </Row>
                </Tab>
                <Tab eventKey="partner" title="Partner">
                    <Row>
                        <Col md={2}></Col>
                        <Col md={8}>
                            <Form>
                                <Form.Group as={Row}>
                                    <Form.Label column sm='4' className='mb-3'>Select Partners<span className='text-danger'>*</span></Form.Label>
                                    <Col sm='8'>
                                        <Select
                                            options={partners.map((partner) => ({ ...partner, value: partner.idUsers, label: partner.fullName }))}
                                            isSearchable
                                            isClearable
                                            placeholder='Select partners'
                                            onChange={(e) => setAssignedPartners(e as PartnerProps)}
                                            value={assignedPartners} />
                                    </Col>
                                </Form.Group>
                                <Form.Group as={Row}>
                                    <Form.Label column sm='4' className='mb-3'>Select Packing<span className='text-danger'>*</span></Form.Label>
                                    <Col sm='8'>
                                        <Select
                                            options={packingList.map((packing) => ({ ...packing, value: packing.idProductPackings, label: packing.packingName + ' - ' + packing.size }))}
                                            isSearchable
                                            isClearable
                                            placeholder='Select packing'
                                            onChange={(e) => setSelectedPacking(e as PackingProps)}
                                            value={selectedPacking} />
                                    </Col>
                                </Form.Group>
                                <Form.Group as={Row}>
                                    <Form.Label column sm='4' className='mb-3'>Sell Rate<span className='text-danger'>*</span></Form.Label>
                                    <Col sm='8'>
                                        <Form.Control type="number" placeholder="Enter sell rate" name="sellRate" onChange={(e) => setSellRate(parseInt(e.target.value))} value={sellRate} />
                                    </Col>
                                </Form.Group>
                            </Form>
                        </Col>
                        <Col md={2}></Col>
                    </Row>
                    <Row>
                        <Col sm='4'></Col>
                        <Col sm='6'>
                            <Row className='justify-content-center'>
                                <Button className='w-50' variant="primary" type="submit" disabled={loading} onClick={handlePartnerAssign}>
                                    {loading && <Spinner as="span" animation="grow" size="sm" role="status" aria-hidden="true" />}
                                    {loading ? 'Submitting...' : 'Submit'}
                                </Button>
                            </Row>
                        </Col>
                    </Row>
                    <Row className='mt-3'>
                        <Table bordered responsive>
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>Partner Name</th>
                                    <th>Email</th>
                                    <th>Phone Number</th>
                                    <th>Packing Name</th>
                                    <th>Size</th>
                                    <th>Sell Rate</th>
                                </tr>
                            </thead>
                            <tbody>
                                {details.ProductPartners?.length > 0 ? (
                                    details.ProductPartners.map((partner, index) => (
                                        <tr key={index}>
                                            <td>{index + 1}</td>
                                            <td>{partner.User.fullName}</td>
                                            <td>{partner.User.email}</td>
                                            <td>{partner.User.phoneNumber}</td>
                                            <td>{partner.ProductPacking.packingName}</td>
                                            <td>{partner.ProductPacking.size}</td>
                                            <td>{partner.sellRate}</td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={7} className="text-center">No partners found</td>
                                    </tr>
                                )}
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
