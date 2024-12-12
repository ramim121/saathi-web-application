import React, { useState, useEffect } from "react";
import MainLayout from "@/layouts/MainLayout";
import { Container, Table, Button, Modal, Row, Col } from "react-bootstrap";
import { postRequestOptions } from "@/utils/Fetch";
import Swal from "sweetalert2";
import { User } from "@/models/__associations";
import UserType from "@/types/User";
import { S3_URL } from "@/config/constants";
import Image from "next/image";
import { NextPage } from "next";
import { API_URL } from "@/config/constants";
import { Form } from "react-bootstrap";

interface UserListProps {
    users: UserType[];
}

const UserList: NextPage<UserListProps> = ({ users }) => {
    const [usersList, setUsersList] = useState<UserType[]>(users);
    const [filteredUsers, setFilteredUsers] = useState<UserType[]>(users);
    const [selectedUser, setSelectedUser] = useState<UserType | null>(null);
    const [showUserDetailsModal, setShowUserDetailsModal] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [filters, setFilters] = useState({
        name: "",
        phoneEmail: "",
        userType: "",
        age: "",
        joining: "",
        partnerType: "",
        status: "",
        nid: "",
        email: "",
        phone: "",
    });

    const verifyUserInformation = async (idUsers: number, verificationType: string, verificationStatus: string = "") => {
        try {
            setIsLoading(true);
            let response = await fetch(
                API_URL + "api/verify",
                postRequestOptions({ idUsers, verificationType, verificationStatus })
            );
            let data = await response.json();
            setIsLoading(false);
            if (data.success) {
                Swal.fire("Success", data.message, "success");
                setSelectedUser(data.userData);
                let updatedUsers = usersList.map((user) => {
                    if (user.idUsers === idUsers) {
                        return { ...user, ...data.userData };
                    }
                    return user;
                });
                setUsersList(updatedUsers);
            } else {
                Swal.fire("Error", data.message, "error");
            }
        } catch (error) {
            setIsLoading(false);
            console.error(error);
            Swal.fire("Error", "Something went wrong", "error");
        }
    };

    useEffect(() => {
        let tempUsers = [...usersList];

        if (filters.name) {
            tempUsers = tempUsers.filter(
                (user) =>
                    user.fullName &&
                    user.fullName.toLowerCase().includes(filters.name.toLowerCase())
            );
        }
        if (filters.phoneEmail) {
            tempUsers = tempUsers.filter(
                (user) =>
                    (user.phoneNumber &&
                        user.phoneNumber.toLowerCase().includes(filters.phoneEmail.toLowerCase())) ||
                    (user.email && user.email.toLowerCase().includes(filters.phoneEmail.toLowerCase()))
            );
        }
        if (filters.userType) {
            tempUsers = tempUsers.filter(
                (user) =>
                    user.userType &&
                    user.userType.toLowerCase().includes(filters.userType.toLowerCase())
            );
        }
        if (filters.age) {
            tempUsers = tempUsers.filter((user) => user.age && user.age.toString() === filters.age);
        }
        if (filters.joining) {
            tempUsers = tempUsers.filter(
                (user) =>
                    user.createdAt &&
                    new Date(user.createdAt).toLocaleDateString("en-In").includes(filters.joining)
            );
        }
        if (filters.partnerType) {
            tempUsers = tempUsers.filter(
                (user) =>
                    user.disability &&
                    user.disability.toLowerCase().includes(filters.partnerType.toLowerCase())
            );
        }
        if (filters.status) {
            tempUsers = tempUsers.filter(
                (user) =>
                    user.status &&
                    user.status.toLowerCase().includes(filters.status.toLowerCase())
            );
        }
        if (filters.nid) {
            tempUsers = tempUsers.filter((user) => user.nidVerified === filters.nid);
        }
        if (filters.email) {
            tempUsers = tempUsers.filter((user) => user.emailVerified === filters.email);
        }
        if (filters.phone) {
            tempUsers = tempUsers.filter((user) => user.phoneVerified === filters.phone);
        }

        setFilteredUsers(tempUsers);
    }, [filters, usersList]);

    return (
        <Container>
            <h4 className="text-start">User List</h4>
            <p>Total Users: {filteredUsers.length}</p>
            <hr />
            <Row className="mb-3">
                <Col>
                    <Form.Label>Search Name</Form.Label>
                    <Form.Control
                        type="text"
                        placeholder="Search by Name"
                        value={filters.name}
                        onChange={(e) => setFilters({ ...filters, name: e.target.value })}
                    />
                </Col>
                <Col>
                    <Form.Label>Search Phone/Email</Form.Label>
                    <Form.Control
                        type="text"
                        placeholder="Search by Phone or Email"
                        value={filters.phoneEmail}
                        onChange={(e) => setFilters({ ...filters, phoneEmail: e.target.value })}
                    />
                </Col>
                <Col>
                    <Form.Label>User Type</Form.Label>
                    <Form.Select
                        value={filters.userType}
                        onChange={(e) => setFilters({ ...filters, userType: e.target.value })}
                    >
                        <option value="">All</option>
                        <option value="admin">Admin</option>
                        <option value="investor">Investor</option>
                        <option value="partner">Partner</option>
                    </Form.Select>
                </Col>
                <Col>
                    <Form.Label>Age</Form.Label>
                    <Form.Control
                        type="text"
                        placeholder="Search by Age"
                        value={filters.age}
                        onChange={(e) => setFilters({ ...filters, age: e.target.value })}
                    />
                </Col>
                <Col>
                    <Form.Label>Joining Date</Form.Label>
                    <Form.Control
                        type="text"
                        placeholder="Search by Joining Date"
                        value={filters.joining}
                        onChange={(e) => setFilters({ ...filters, joining: e.target.value })}
                    />
                </Col>
            </Row>
            <Row className="mb-3">
                <Col>
                    <Form.Label>NID Verification</Form.Label>
                    <Form.Select
                        value={filters.nid}
                        onChange={(e) => setFilters({ ...filters, nid: e.target.value })}
                    >
                        <option value="">All</option>
                        <option value="yes">Verified</option>
                        <option value="no">Not Verified</option>
                    </Form.Select>
                </Col>
                <Col>
                    <Form.Label>Email Verification</Form.Label>
                    <Form.Select
                        value={filters.email}
                        onChange={(e) => setFilters({ ...filters, email: e.target.value })}
                    >
                        <option value="">All</option>
                        <option value="yes">Verified</option>
                        <option value="no">Not Verified</option>
                    </Form.Select>
                </Col>
                <Col>
                    <Form.Label>Phone Verification</Form.Label>
                    <Form.Select
                        value={filters.phone}
                        onChange={(e) => setFilters({ ...filters, phone: e.target.value })}
                    >
                        <option value="">All</option>
                        <option value="yes">Verified</option>
                        <option value="no">Not Verified</option>
                    </Form.Select>
                </Col>
            </Row>
            <Table responsive striped bordered hover size="sm">
                <thead>
                    <tr>
                        <th>#</th>
                        <th></th>
                        <th>Name</th>
                        <th>Phone / Email</th>
                        <th>Type</th>
                        <th>Age</th>
                        <th>Joining</th>
                        <th>Disability</th>
                        <th>status</th>
                        <th>Documents</th>
                    </tr>
                </thead>
                <tbody>
                    {filteredUsers.length > 0 ? (
                        filteredUsers.map((user, index) => (
                            <tr key={index}>
                                <td>{user.idUsers}</td>
                                <td>
                                    {user.profileImage ? (
                                        <Image
                                            alt="profile"
                                            height="50"
                                            width="50"
                                            src={S3_URL + "profile/" + user.profileImage}
                                        />
                                    ) : (
                                        <Image
                                            alt="profile"
                                            height="50"
                                            width="50"
                                            src="https://picsum.photos/id/185/50/50"
                                        />
                                    )}
                                </td>
                                <td>
                                    <Button
                                        style={{ whiteSpace: "nowrap" }}
                                        type="button"
                                        variant="link"
                                        className="p-0"
                                        onClick={() => {
                                            setSelectedUser(user);
                                            setShowUserDetailsModal(true);
                                        }}
                                    >
                                        {user.fullName}
                                    </Button>
                                </td>
                                <td>
                                    {user.phoneNumber}
                                    <br />
                                    {user.email}
                                </td>
                                <td className="text-capitalize">{user.userType}</td>
                                <td>{user.age}</td>
                                <td>{new Date(user.createdAt).toLocaleDateString("en-In")}</td>
                                <td>{user.disability}</td>
                                <td className="text-capitalize">{user.status}</td>
                                <td style={{ whiteSpace: "nowrap" }}>
                                    NID Verified: {user.nidVerified === "yes" ? "Yes" : "No"}
                                    <br />
                                    Phone Verified: {user.phoneVerified === "yes" ? "Yes" : "No"}
                                    <br />
                                    Email Verified: {user.emailVerified === "yes" ? "Yes" : "No"}
                                </td>
                            </tr>
                        ))
                    ) : (
                        <tr>
                            <td colSpan={10} className="text-center">
                                No data found
                            </td>
                        </tr>
                    )}
                </tbody>
            </Table>
            {selectedUser && (
                <Modal
                    size="lg"
                    show={showUserDetailsModal}
                    onHide={() => setShowUserDetailsModal(false)}
                >
                    <Modal.Body>
                        <Row>
                            <Col md={4}>
                                <Image
                                    alt="profile"
                                    height="150"
                                    width="150"
                                    src={
                                        selectedUser.profileImage
                                            ? `${S3_URL}profile/${selectedUser.profileImage}`
                                            : "https://picsum.photos/id/185/150/150"
                                    }
                                />
                            </Col>
                            <Col md={8}>
                                <Col md={8}>
                                    <h5>Personal Information</h5>
                                    <hr />
                                    <p className="my-1">Name: {selectedUser!.fullName}</p>
                                    <p className="my-1">
                                        Email: {selectedUser!.email}
                                        {
                                            selectedUser!.emailVerified == 'yes' ?
                                                <span className="text-success"> (Verified)</span> :
                                                <>
                                                    <span className="text-danger"> (Not Verified)</span>
                                                    <Button disabled={isLoading} variant="primary" size="sm" onClick={() => { verifyUserInformation(selectedUser.idUsers, "email") }}>Mark as verified</Button>
                                                </>
                                        }
                                    </p>
                                    <p className="my-1">
                                        Phone: {selectedUser!.phoneNumber}
                                        {
                                            selectedUser!.phoneVerified == 'yes' ?
                                                <span className="text-success"> (Verified)</span> :
                                                <>
                                                    <span className="text-danger"> (Not Verified)</span>
                                                    <Button disabled={isLoading} variant="primary" size="sm" onClick={() => { verifyUserInformation(selectedUser.idUsers, "phone") }}>Mark as verified</Button>
                                                </>
                                        }
                                    </p>
                                    <p className="my-1">Date of Birth: {new Date(selectedUser!.dateOfBirth).toLocaleDateString()}</p>
                                    <p className="my-1">Interested in: {selectedUser!.interestedIn}</p>
                                    <p className="my-1">Skills: {selectedUser!.skills}</p>
                                    <p className="my-1">Bio: {selectedUser!.bio}</p>
                                    <p className="my-1">Location: {selectedUser!.location}</p>
                                    <p className="my-1">Role: {selectedUser!.role}</p>
                                    <p className="my-1">Age: {selectedUser!.age}</p>
                                    <p className="my-1">Education: {selectedUser!.education}</p>
                                    <p className="my-1">Disability: {selectedUser!.disability}</p>
                                    <p className="my-1">Partner Type: {selectedUser!.partnerType}</p>
                                    {
                                        selectedUser.nidVerificationStatus != 'none' &&
                                        <>
                                            <p className="my-1">
                                                NID number: {selectedUser!.nidNumber}
                                                {
                                                    selectedUser!.nidVerified == 'yes' ?
                                                        <span className="text-success"> (Verified)</span> :
                                                        <>
                                                            <span className="text-danger"> {selectedUser.nidVerificationStatus}</span>
                                                            {
                                                                selectedUser.nidVerificationStatus == 'pending' &&
                                                                <>
                                                                    <Button className="mx-3" disabled={isLoading} variant="success" size="sm" onClick={() => { verifyUserInformation(selectedUser.idUsers, "nid", "approved") }}>Approve</Button>
                                                                    <Button disabled={isLoading} variant="danger" size="sm" onClick={() => { verifyUserInformation(selectedUser.idUsers, "nid", "rejected") }}>Reject</Button>
                                                                </>
                                                            }
                                                        </>
                                                }
                                            </p>
                                            <hr />
                                            <Row>
                                                <Col>
                                                    <img width={"100%"} src={`${S3_URL}nid/${selectedUser!.nidImageFront}`} alt="NID Front"></img>
                                                </Col>
                                                <Col>
                                                    <img width={"100%"} src={`${S3_URL}nid/${selectedUser!.nidImageBack}`} alt="NID Back"></img>
                                                </Col>
                                            </Row>
                                        </>
                                    }
                                </Col>
                            </Col>
                        </Row>
                    </Modal.Body>
                </Modal>
            )}
        </Container>
    );
};

export default UserList;

// @ts-ignore
UserList.getLayout = function PageLayout(page: any) {
    return <MainLayout>{page}</MainLayout>;
};

export async function getServerSideProps() {
    const users = await User.findAll();
    return {
        props: {
            users: JSON.parse(JSON.stringify(users)),
        },
    };
}
