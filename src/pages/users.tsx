import React, { useState, useEffect } from "react";
import MainLayout from "@/layouts/MainLayout";
import { Container, Table, Button, Pagination, Tab, Modal, Row, Col } from "react-bootstrap";
import { getRequestOptions } from "@/utils/Fetch";
import Link from "next/link";
import Swal from "sweetalert2";
import { User } from "@/models/__associations";
import UserType from "@/types/User";
import { S3_URL } from '@/config/constants';
import Image from "next/image";
import { NextPage } from "next";

interface UserListProps {
    users: UserType[]
}

const UserList: NextPage<UserListProps> = ({ users }) => {
    const [usersList, setUsersList] = useState<UserType[]>(users);
    const [selectedUser, setSelectedUser] = useState<UserType | null>(null);
    const [showUserDetailsModal, setShowUserDetailsModal] = useState(false);

    return (
        <Container>
            <h4 className="text-start">User List</h4>
            <hr />
            <Table responsive striped bordered hover size="sm">
                <thead>
                    <tr>
                        <th>#</th>
                        <th></th>
                        <th>Name</th>
                        <th>Phone</th>
                        <th>email</th>
                        <th>Type</th>
                        <th>Age</th>
                        <th>Joining</th>
                        <th>Partner Type</th>
                        <th>status</th>
                        <th>Documents</th>
                    </tr>
                </thead>
                <tbody>
                    {usersList.length > 0 ? usersList.map((user, index) => (
                        <tr key={index}>
                            <td>{user.idUsers}</td>
                            <td>
                                {
                                    user.profileImage ?
                                        <Image alt="profile" height="50" width="50" src={S3_URL + "profile/" + user.profileImage}></Image> :
                                        <Image alt="profile" height="50" width="50" src="https://picsum.photos/id/185/50/50"></Image>
                                }
                            </td>
                            <td>
                                <Button type="button" variant="link" className="p-0" onClick={() => {
                                    setSelectedUser(user);
                                    setShowUserDetailsModal(true);
                                }}>
                                    {user.fullName}
                                </Button>
                            </td>
                            <td>{user.phoneNumber}</td>
                            <td>{user.email}</td>
                            <td className="text-capitalize">{user.userType}</td>
                            <td>{user.age}</td>
                            <td>{new Date(user.createdAt).toLocaleDateString('en-In')}</td>
                            <td>{user.disability}</td>
                            <td className="text-capitalize">{user.status}</td>
                            <td style={{ whiteSpace: "nowrap" }}>
                                NID Verified: {user.nidVerified ? "Yes" : "No"}<br />
                                Phone Verified: {user.phoneVerified ? "Yes" : "No"}<br />
                                Email Verified: {user.emailVerified ? "Yes" : "No"}
                            </td>
                        </tr>
                    )) : (
                        <tr>
                            <td colSpan={10} className="text-center">No data found</td>
                        </tr>
                    )}
                </tbody>
            </Table>

            {
                selectedUser && <>
                    <Modal size="lg" show={showUserDetailsModal} onHide={() => { setShowUserDetailsModal(false) }}>
                        <Modal.Body style={{ maxHeight: 'calc(100vh - 160px)', overflowY: 'auto' }}>
                            <Row>
                                <Col md={4}>
                                    {
                                        selectedUser.profileImage ?
                                            <img
                                                src={`${S3_URL}profile/${selectedUser!.profileImage}`}
                                                alt="Profile Picture"
                                                width="100%"
                                            /> :
                                            <img
                                                src={`https://picsum.photos/id/185/50/50`}
                                                alt="Profile Picture"
                                                width="100%"
                                            />
                                    }
                                </Col>
                                <Col md={8}>
                                    <h5>Personal Information</h5>
                                    <hr />
                                    <p className="my-1">Name: {selectedUser!.fullName}</p>
                                    <p className="my-1">
                                        Email: {selectedUser!.email}
                                        {
                                            selectedUser!.emailVerified ?
                                                <span className="text-success"> (Verified)</span> :
                                                <>
                                                    <span className="text-danger"> (Not Verified)</span>
                                                    <Button variant="primary" size="sm" onClick={() => { }}>Mark as verified</Button>
                                                </>
                                        }
                                    </p>
                                    <p className="my-1">
                                        Phone: {selectedUser!.phoneNumber}
                                        {
                                            selectedUser!.phoneVerified ?
                                                <span className="text-success"> (Verified)</span> :
                                                <>
                                                    <span className="text-danger"> (Not Verified)</span>
                                                    <Button variant="primary" size="sm" onClick={() => { }}>Mark as verified</Button>
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
                                    <p className="my-1">
                                        NID number: {new Date(selectedUser!.createdAt).toLocaleDateString()}
                                        {
                                            selectedUser!.nidVerified ?
                                                <span className="text-success"> (Verified)</span> :
                                                <>
                                                    <span className="text-danger"> (Not Verified)</span>
                                                    <Button variant="primary" size="sm" onClick={() => { }}>Mark as verified</Button>
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
                                </Col>
                            </Row>
                        </Modal.Body>
                    </Modal>
                </>
            }
        </Container>
    )
}

export default UserList;

UserList.getLayout = function PageLayout(page: any) {
    return (
        <MainLayout>
            {page}
        </MainLayout>
    )
}

export async function getServerSideProps() {
    const users = await User.findAll();
    console.log(users.length);
    return {
        props: {
            users: JSON.parse(JSON.stringify(users))
        }
    }
}
