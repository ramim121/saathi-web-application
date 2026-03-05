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
            <div className="page-top mb-3" style={{ resize: "block", backgroundRepeat: "no-repeat", backgroundSize: "1920px", backgroundImage: "url(/assets/images/background-main.png)" }}>
                <Navbar expand="lg" bg="none" className='text-light'>
                    <Container style={{ maxWidth: "1140px" }}>
                        <Navbar.Brand href="/">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                alt=""
                                src="/assets/images/logo-header.png"
                                width="auto"
                                height="50"
                                className="d-inline-block align-top" />

                        </Navbar.Brand>
                        <Navbar.Toggle aria-controls="basic-navbar-nav" />
                        <Navbar.Collapse id="basic-navbar-nav">

                            <Nav className="ms-auto">
                                <Nav.Link href="/users">Users</Nav.Link>
                                <NavDropdown title="Setups" id="basic-nav-dropdown">
                                    <NavDropdown.Item href="/setup/investment">Investment</NavDropdown.Item>
                                    <NavDropdown.Item href="/setup/stat_panel">Stat Panel</NavDropdown.Item>
                                    <NavDropdown.Item href="/setup/project_category">Project Category</NavDropdown.Item>
                                    <NavDropdown.Item href="/setup/skill">Skill</NavDropdown.Item>
                                    <NavDropdown.Item href="/setup/unit">Unit</NavDropdown.Item>
                                    <NavDropdown.Item href="/setup/partnership">Partnership</NavDropdown.Item>
                                    <NavDropdown.Item href="/setup/investor_testimonial">Investor Testimonial</NavDropdown.Item>
                                </NavDropdown>
                                <Nav.Link href="/notification">Notification</Nav.Link>
                                <NavDropdown title="Partners" id="basic-nav-dropdown">
                                    <NavDropdown.Item href="/partners/registration">Registration</NavDropdown.Item>
                                    <NavDropdown.Item href="/partners/list">List</NavDropdown.Item>
                                </NavDropdown>
                                <NavDropdown title="Projects" id="basic-nav-dropdown">
                                    <NavDropdown.Item href="/projects/create">Create</NavDropdown.Item>
                                    <NavDropdown.Item href="/projects/list">List</NavDropdown.Item>
                                    <NavDropdown.Item href="/projects/partner_assign">Partner Assign</NavDropdown.Item>
                                    <NavDropdown.Item href="/projects/project_assign">Project Assign</NavDropdown.Item>
                                </NavDropdown>
                                <NavDropdown title="Products" id="basic-nav-dropdown">
                                    <NavDropdown.Item href="/products/category">Category</NavDropdown.Item>
                                    <NavDropdown.Item href="/products/create">Create</NavDropdown.Item>
                                    <NavDropdown.Item href="/products/list">List</NavDropdown.Item>
                                </NavDropdown>
                                <NavDropdown title="Bookings" id="basic-nav-dropdown">
                                    <NavDropdown.Item href="/bookings/create">Create</NavDropdown.Item>
                                    <NavDropdown.Item href="/bookings/list">List</NavDropdown.Item>
                                    <NavDropdown.Item href="/bookings/active-booking">Active Booking</NavDropdown.Item>
                                </NavDropdown>
                                <NavDropdown title="Orders" id="basic-nav-dropdown">
                                    <NavDropdown.Item href="/orders/list">List</NavDropdown.Item>
                                </NavDropdown>
                                <NavDropdown title="Blogs" id="basic-nav-dropdown">
                                    <NavDropdown.Item href="/blogs/create">Create</NavDropdown.Item>
                                    <NavDropdown.Item href="/blogs/list">List</NavDropdown.Item>
                                </NavDropdown>
                                <NavDropdown title="Profile" id="basic-nav-dropdown">
                                    <NavDropdown.Item href="/admin/registration">Registration</NavDropdown.Item>
                                    <NavDropdown.Item href="/logout">
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