import MainLayout from "@/layouts/MainLayout";
import { Button, Col, Container, Form, Row } from "react-bootstrap";

function StatPanel() {

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
    }

    return (
        <Container>
            <Row className="justify-content-center">
                <Col md={6}>
                    <h2 className="text-center">Blog Create</h2>
                    <hr />
                    <Form onSubmit={handleSubmit}>
                        {/* <Form.Group as={Row}>
                                <Form.Label column sm='4' className='mb-3'>Investment Type<span className='text-danger'>*</span></Form.Label>
                                <Col sm='8'>
                                    <Form.Select name='investmentType' onChange={handleInvestmentTypeChange} value={formData.investmentType}>
                                        <option>Select investment type</option>
                                        <option value="high_return">High Return</option>
                                        <option value="low_return">Low Return</option>
                                        <option value="short_duration">Short Duration</option>
                                        <option value="long_duration">Long Duration</option>
                                        <option value="shariah">Shariah</option>
                                    </Form.Select>
                                </Col>
                            </Form.Group> */}
                        <Row>
                            <Col sm='4'></Col>
                            <Col sm='8'>
                                <Row className='justify-content-center'>
                                    <Button className='w-50' variant="primary" type="submit">
                                        Submit
                                    </Button>
                                </Row>
                            </Col>
                        </Row>
                    </Form>
                </Col>
            </Row>
        </Container>
    )
}

export default StatPanel;

StatPanel.getLayout = function PageLayout(page: any) {
    return (
        <MainLayout>
            {page}
        </MainLayout>
    )
}