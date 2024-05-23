import { Col, Container, Row } from "react-bootstrap"

function Footer() {
    return (
        <>
            <div className='footer-layout' style={{ resize:"block", backgroundRepeat:"no-repeat", backgroundSize:"1920px", backgroundImage: "url(/assets/images/background-main.png)" }}>
                <Container className='py-4' style={{ maxWidth: "1140px" }}>
                    <Row>
                        <Col md={8}>
                            <div style={{ fontWeight: 'bold', fontSize: '46px', lineHeight: '56px' }}>Contact us</div>
                            <div style={{ fontWeight: 'bold', fontSize: '30px', lineHeight: '39px', marginTop: '30px' }}>Saathi</div>
                            <div style={{ fontSize: '17px', marginTop: '10px' }}>Dhaka, bangladesh</div>
                        </Col>
                        <Col md={4}>
                            <div style={{ fontSize: '30px', lineHeight: '40px' }}>01966662633</div>
                            <div style={{ fontSize: '20px' }}>contact@digigram.com</div>
                        </Col>
                    </Row>
                </Container >

            </div >

        </>
    )
}

export default Footer