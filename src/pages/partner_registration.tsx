import React, { useState } from 'react';
import { Form, Card, CardBody } from 'react-bootstrap';

interface FormDataType {
    name: string,
    email: string,
    phoneNumber: number,
    age: number
}

function PartnerRegistration() {
    const [formData, setFormData] = useState<FormDataType>({
        name: '',
        email: '',
        phoneNumber: 0,
        age: 0
    });

    const handleOnChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    }

    return (
        <Card>
            <Card.Header>
                <h3>Partner Registration</h3>
            </Card.Header>
            <CardBody>
                <Form>
                    <Form.Group>
                        <Form.Label>Name</Form.Label>
                        <Form.Control type="text" placeholder="Enter your full name" name="name" onChange={handleOnChange} />
                    </Form.Group>
                    <Form.Group>
                        <Form.Label>Email</Form.Label>
                        <Form.Control type="email" placeholder="Enter your email" name="email" onChange={handleOnChange} />
                    </Form.Group>
                    <Form.Group>
                        <Form.Label>Phone Number</Form.Label>
                        <Form.Control type="number" placeholder="Enter your phone number" name="phoneNumber" onChange={handleOnChange} />
                    </Form.Group>
                    <Form.Group>
                        <Form.Label>Age</Form.Label>
                        <Form.Control type="number" placeholder="Enter your age" name="age" onChange={handleOnChange} />
                    </Form.Group>
                </Form>
            </CardBody>

        </Card>
    );
}

export default PartnerRegistration;