import React, { useState, useEffect } from "react";
import MainLayout from "@/layouts/MainLayout";
import { Container, Table, Button } from "react-bootstrap";
import { getRequestOptions } from "@/utils/Fetch";
import Swal from "sweetalert2";

interface ListProps {
    idBlogs: number,
    heading: string,
    description: string,
    writtenBy: string,
    writtenDate: string,
}

function List() {
    const [blogsList, setBlogsList] = useState<ListProps[]>([]);

    useEffect(() => {
        const fetchBlogsList = async () => {
            try {
                const res = await fetch('/api/blogs/list', getRequestOptions());
                const data = await res.json();
                if (res.status === 200) {
                    setBlogsList(data.data);
                } else {
                    Swal.fire({
                        icon: 'error',
                        title: 'Error',
                        text: data.message,
                    });
                }
            } catch (err: any) {
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: err.message,
                });
            }
        }
        fetchBlogsList();
    }, []);

    return (
        <Container>
            <h2 className="text-center">Blogs List</h2>
            <hr />
            <Table responsive striped bordered hover>
                <thead>
                    <tr>
                        <th>#</th>
                        <th>Heading</th>
                        <th>Description</th>
                        <th>Written By</th>
                        <th>Written Date</th>
                    </tr>
                </thead>
                <tbody>
                    {blogsList.length > 0 ? blogsList.map((blog, index) => (
                        <tr key={index}>
                            <td>{index + 1}</td>
                            <td>{blog.heading}</td>
                            <td dangerouslySetInnerHTML={{ __html: blog.description }}></td>
                            <td>{blog.writtenBy}</td>
                            <td>{blog.writtenDate}</td>
                        </tr>
                    )) : (
                        <tr>
                            <td colSpan={5} className="text-center">No blogs found</td>
                        </tr>
                    )}

                </tbody>
            </Table>
        </Container>
    )

}

export default List;

List.getLayout = function PageLayout(page: any) {
    return (
        <MainLayout>
            {page}
        </MainLayout>
    )
}