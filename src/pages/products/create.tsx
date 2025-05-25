import React, { useState, useEffect } from 'react';
import MainLayout from '@/layouts/MainLayout';
import { Button, Col, Container, Form, Row, Spinner } from 'react-bootstrap';
import { API_URL } from '@/config/constants';
import Swal from 'sweetalert2';
import Select from 'react-select';
import { useRouter } from 'next/router';
import { postRequestOptions } from "@/utils/Fetch";

interface FormDataType {
    productName: string;
    idProductCategories: string;
    idUnit: string;
    productDescription: string;
}

interface ProductCategoryType {
    idProductCategories: number;
    productCategoryName: string;
    productCategoryId: string;
}

interface UnitType {
    idUnit: number;
    unitName: string;
    unitCode: string;
}

function ProductCreate() {
    const router = useRouter();
    const [formData, setFormData] = useState<FormDataType>({
        productName: '',
        idProductCategories: '',
        idUnit: '',
        productDescription: '',
    });

    const [productCategories, setProductCategories] = useState<ProductCategoryType[]>([]);
    const [units, setUnits] = useState<UnitType[]>([]);
    const [loading, setLoading] = useState<boolean>(false);


    useEffect(() => {
        fetchProductCategory();
        fetchUnit();
    }, []);

    const fetchProductCategory = async () => {
        try {
            const res = await fetch(API_URL + 'api/product-categories/get_all_categories');
            const data = await res.json();
            if (res.status === 200) {
                setProductCategories(data.data);
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

    const fetchUnit = async () => {
        try {
            const res = await fetch(API_URL + 'api/unit/get_all_unit');
            const data = await res.json();
            if (res.status === 200) {
                setUnits(data.data);
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

    const handleOnChange = (e: React.ChangeEvent<HTMLInputElement>) => {

        const { name, value } = e.target;

        setFormData({
            ...formData,
            [name]: value
        });
    }

    const handleProductCategoryChange = (e: any) => {
        setFormData({
            ...formData,
            idProductCategories: e ? e.value : ''
        });
    }

    const handleUnitChange = (e: any) => {
        setFormData({
            ...formData,
            idUnit: e ? e.value : ''
        });
    }

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setLoading(true);

        Swal.fire({
            title: 'Are you sure?',
            text: "You want to create this product!",
            icon: 'warning',
            showCancelButton: true,
            cancelButtonText: 'No',
            confirmButtonText: 'Yes'
        }).then(async (result) => {
            if (result.value) {
                try {
                    const res = await fetch(API_URL + 'api/products/create', postRequestOptions(formData));

                    if (res.status === 200) {
                        Swal.fire({
                            icon: 'success',
                            title: 'Success',
                            text: 'Product created successfully!',
                        });
                        router.push('/products/details/' + (await res.json()).data.idProducts);
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
        <Container>
            <Row>
                <Col md={2}></Col>
                <Col md={8}>
                    <h4 className="text-start">Product Create</h4>
                    <hr />
                    <Row>
                        <Col md={8}>
                            <Form onSubmit={handleSubmit}>
                                <Form.Group as={Row}>
                                    <Form.Label column sm='4' className='mb-3'>Product Name<span className='text-danger'>*</span></Form.Label>
                                    <Col sm='8'>
                                        <Form.Control type="text" placeholder="Enter product name" name="productName" onChange={handleOnChange} value={formData.productName} />
                                    </Col>
                                </Form.Group>
                                <Form.Group as={Row}>
                                    <Form.Label column sm='4' className='mb-3'>Product Category<span className='text-danger'>*</span></Form.Label>
                                    <Col sm='8'>
                                        <Select
                                            options={productCategories.map((category) => ({ value: category.idProductCategories, label: category.productCategoryName }))}
                                            isSearchable
                                            isClearable
                                            placeholder='Select product category'
                                            onChange={(e) => handleProductCategoryChange(e)}
                                            value={productCategories.filter((category) => category.idProductCategories === parseInt(formData.idProductCategories)).map((category) => ({ value: category.idProductCategories, label: category.productCategoryName }))}
                                        />
                                    </Col>
                                </Form.Group>
                                <Form.Group as={Row}>
                                    <Form.Label column sm='4' className='mb-3'>Unit<span className='text-danger'>*</span></Form.Label>
                                    <Col sm='8'>
                                        <Select
                                            options={units.map((unit) => ({ value: unit.idUnit, label: unit.unitName + ' (' + unit.unitCode + ')' }))}
                                            isSearchable
                                            isClearable
                                            placeholder='Select unit'
                                            onChange={(e) => handleUnitChange(e)}
                                            value={units.filter((unit) => unit.idUnit === parseInt(formData.idUnit)).map((unit) => ({ value: unit.idUnit, label: unit.unitName }))}
                                        />
                                    </Col>
                                </Form.Group>

                                <Form.Group as={Row}>
                                    <Form.Label column sm='4' className='mb-3'>Product Description</Form.Label>
                                    <Col sm='8'>
                                        <Form.Control as="textarea" placeholder="Enter product description" name="productDescription" onChange={handleOnChange} value={formData.productDescription} />
                                    </Col>
                                </Form.Group>
                                <Row>
                                    <Col sm='4'></Col>
                                    <Col sm='8'>
                                        <Row className='justify-content-center'>
                                            <Button className='w-50 mt-2' variant="primary" type="submit" disabled={loading}>
                                                {loading && <Spinner as="span" animation="grow" size="sm" role="status" aria-hidden="true" />}
                                                {loading ? 'Submitting...' : 'Submit'}
                                            </Button>
                                        </Row>
                                    </Col>
                                </Row>
                            </Form>
                        </Col>
                    </Row>
                </Col>
                <Col md={2}></Col>
            </Row>
        </Container>

    )
}

export default ProductCreate;

ProductCreate.getLayout = function PageLayout(page: any) {
    return (
        <MainLayout>
            {page}
        </MainLayout>
    )
}