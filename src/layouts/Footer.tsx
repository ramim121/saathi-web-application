import { Col, Container, Row } from "react-bootstrap"

function Footer() {
    return (
        <>
            <div className='footer-layout mt-3' style={{ backgroundRepeat: "no-repeat", backgroundSize: "cover", backgroundPosition: "center", backgroundImage: "url(/assets/images/background-main.png)" }}>
                <Container fluid className='pt-4 px-3 px-md-4 px-xl-5'>
                    <Row>
                        <Col start md={{ span: 8, offset: 2 }}>
                            <h5 className='text-white text-center'>Contact for instant support:</h5>
                            <hr />
                            <p className='text-white text-center'>Ramim S. Hossain<br/>01966662633<br/>ramim121@gmail.com</p>
                        </Col>
                    </Row>
                </Container >

            </div >

        </>
    )
}

export default Footer