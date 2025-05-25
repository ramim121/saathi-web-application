import React, { useState, useEffect } from "react";
import MainLayout from "@/layouts/MainLayout";
import { Button, Col, Container, Form, Row, Spinner } from 'react-bootstrap';

function Create() {

    return (
        <Container>
            <Row>
                <Col md={2}></Col>
                <Col md={8}>
                    <h4 className="text-start">Manual Booking Create</h4>
                    <hr />
                </Col>
                <Col md={2}></Col>
            </Row>
        </Container>
    )

}

export default Create;

Create.getLayout = function PageLayout(page: any) {
    return (
        <MainLayout>
            {page}
        </MainLayout>
    )
}
