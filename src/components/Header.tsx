import { useEffect, useState } from 'react';

import Head from "next/head"
import { Container, Nav, Image, Navbar, NavDropdown } from "react-bootstrap"
import { Montserrat } from "next/font/google"
import { getCookie } from '@/utils/GetCookie';
import { getRequestOptions } from '@/utils/Fetch';

const montserrat = Montserrat({ subsets: ['cyrillic-ext'] })

type userProfile = {
    idUsers: number,
    userType: string,
    firstName: string,
    lastName: string,
    email: string,
    phoneNumber: string,
    profilePicture: string,
    idCompanies: number,
    status: string
}

function Header() {
    const [user, setUser] = useState<userProfile>();

    useEffect(() => {
        getUserData();
    }, [])

    async function getUserData() {

        let token = getCookie('saathi-token')
        if (!token) { return }

        const res = await fetch('/api/user', getRequestOptions());

        const data = await res.json();
        setUser(data.user);
    }

    return (
        <>
            <Head>
                <title>Saathi | A Digigram venture</title>
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link rel="preconnect" href="https://fonts.gstatic.com" />
                <meta content="width=device-width, initial-scale=1" name="viewport" />
                <meta name="description" content="Saathi is an investment management application" />
            </Head>
            <div className="page-top" style={{ resize: "block", backgroundRepeat: "no-repeat", backgroundSize: "1920px", backgroundImage: "url(/assets/images/background-main.png)" }}>
                <Navbar expand="lg" bg="none" className='text-light'>
                    <Container style={{ maxWidth: "1140px" }}>
                        <Navbar.Brand href="/">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                alt=""
                                src="/assets/images/logo-header.png"
                                width="170"
                                height="50"
                                className="d-inline-block align-top" />

                        </Navbar.Brand>
                        <Navbar.Toggle aria-controls="basic-navbar-nav" />
                        <Navbar.Collapse id="basic-navbar-nav">
                            <Nav className="ms-auto">
                                <Nav.Link className='mx-3' href="/partners">Partners</Nav.Link>
                                <Nav.Link className='mx-3' href="/projects">Projects</Nav.Link>
                                <Nav.Link className='mx-3' href="/investments">Investments</Nav.Link>
                                <NavDropdown title="Profile" id="basic-nav-dropdown">
                                    <NavDropdown.Item href="#action/3.1">Action</NavDropdown.Item>
                                    <NavDropdown.Item href="#action/3.2">
                                        Another action
                                    </NavDropdown.Item>
                                    <NavDropdown.Item href="#action/3.3">Something</NavDropdown.Item>
                                    <NavDropdown.Divider />
                                    <NavDropdown.Item href="#action/3.4">
                                        Logout
                                    </NavDropdown.Item>
                                </NavDropdown>
                            </Nav>
                        </Navbar.Collapse>
                    </Container>
                </Navbar>
            </div >
            {/* <FacebookMsg /> */}
        </>

    )
}

export default Header