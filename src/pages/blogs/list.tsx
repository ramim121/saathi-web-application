import React, { useState, useEffect } from "react";
import MainLayout from "@/layouts/MainLayout";
import { Container, Table, Button } from "react-bootstrap";
import { getRequestOptions, deleteRequestOptions } from "@/utils/Fetch";
import Swal from "sweetalert2";
import { S3_URL } from '@/config/public';
import { API_URL } from '@/config/public';
import Link from "next/link";

interface ListProps {
    idBlogs: number,
    heading: string,
    description: string,
    writtenBy: string,
    writtenDate: string,
    featuredImage: string | null
}

function List() {
    const [blogsList, setBlogsList] = useState<ListProps[]>([]);
    const [reload, setReload] = useState<boolean>(true);

    useEffect(() => {
        const fetchBlogsList = async () => {
            try {
                const res = await fetch('/api/blogs/list', getRequestOptions());
                const data = await res.json();
                if (res.status === 200) {
                    setBlogsList(data.data);
                    setReload(false);
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
    }, [reload]);

    const handleDelete = async (id: number) => {
        Swal.fire({
            title: 'Are you sure?',
            text: "You want to delete this blog!",
            icon: 'warning',
            showCancelButton: true,
            cancelButtonText: 'No',
            confirmButtonText: 'Yes'
        }).then(async (result) => {
            if (result.value) {
                try {
                    const res = await fetch(API_URL + 'api/blogs/delete/' + id, deleteRequestOptions());

                    if (res.status === 200) {
                        Swal.fire({
                            icon: 'success',
                            title: 'Success',
                            text: 'Blog deleted successfully',
                        });
                        setReload(true);
                    } else {
                        Swal.fire({
                            icon: 'error',
                            title: 'Error',
                            html: (await res.json()).message,
                        });
                    }
                } catch (err) {
                    Swal.fire({
                        icon: 'error',
                        title: 'Error',
                        text: 'Something went wrong!',
                    });
                }
            }
        });
    }


    return (
        <Container>
            <h4 className="text-start">Blogs List</h4>
            <hr />
            <Table responsive striped bordered hover>
                <thead>
                    <tr>
                        <th>#</th>
                        <th>Heading</th>
                        <th>Description</th>
                        <th>Written By</th>
                        <th>Written Date</th>
                        <th>Featured Image</th>
                        <th>Action</th>
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
                            <td>
                                {blog.featuredImage && <img src={`${S3_URL}blog-featured-images/${blog.featuredImage}`} alt={blog.featuredImage} width={100} height={100} />}
                            </td>
                            <td style={{ whiteSpace: 'nowrap' }}>
                                <Button variant="danger" size="sm" onClick={() => handleDelete(blog.idBlogs)} className="me-2">Delete</Button>
                                <Link href={`/blogs/edit/${blog.idBlogs}`}>
                                    <Button variant="info" size="sm">Edit</Button>
                                </Link>
                            </td>
                        </tr>
                    )) : (
                        <tr>
                            <td colSpan={7} className="text-center">No blogs found</td>
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