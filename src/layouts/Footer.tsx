import { Col, Container, Row } from "react-bootstrap"

function Footer() {
    return (
        <>
            <div className='footer-layout mt-3' style={{ resize: "block", backgroundRepeat: "no-repeat", backgroundSize: "1920px", backgroundImage: "url(/assets/images/background-main.png)" }}>
                <Container className='pt-4' style={{ maxWidth: "1140px" }}>
                    <Row>
                        {/* `start` is not a Col prop — react-bootstrap forwarded it to the
                            div, so React logged a non-boolean-attribute warning on every
                            page render. The children are centred by their own classes. */}
                        <Col md={{ span: 8, offset: 2 }}>
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