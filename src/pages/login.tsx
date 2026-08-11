/* eslint-disable @next/next/no-img-element */
import { useState, useContext } from 'react';
import { AppContext } from '../context/AppContext';
import { API_URL } from '@/config/public';
import Cookies from "js-cookie";
import { Button, Col, Container, Form, Row, Spinner } from 'react-bootstrap';
import { useRouter } from 'next/router';
import Swal from 'sweetalert2';

const LoginPage = () => {
	const [email, setEmail] = useState<string>('');
	const [password, setPassword] = useState<string>('');
	const { token, currentUser, updateUserInfo } = useContext(AppContext);
	const [loading, setLoading] = useState<boolean>(false);
	const router = useRouter();

	const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		setEmail(e.target.value);
	};

	const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		setPassword(e.target.value);
	};

	const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		const formData = {
			email: email,
			password: password
		};

		try {
			setLoading(true);
			const res = await fetch(API_URL + 'api/login', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(formData)
			});

			const data = await res.json();
			if (res.status === 200) {
				Cookies.set('saathi-token', data.token);
				updateUserInfo({
					idUsers: data.user.idUsers,
					fullName: data.user.fullName,
					profileImage: data.user.profileImage,
					email: data.user.email,
					phoneNumber: data.user.phoneNumber,
					userType: data.user.userType
				});
				router.push('/');
			} else {
				Swal.fire({
					icon: 'error',
					title: 'Error',
					html: data.message,
				});
			}
			setLoading(false);

		} catch (err: any) {
			Swal.fire({
				icon: 'error',
				title: 'Error',
				text: err.message,
			});
			setLoading(false);
		}
	};

	return (
		<div style={{ height: "95vh" }} className="App">
			<div className="h-100 d-flex justify-content-center align-items-center">

				<Container>
					<Row className="justify-content-md-center">
						<Col md="4">
							{/* eslint-disable-next-line @next/next/no-img-element */}
							<div className='d-flex justify-content-center p-5 pb-3'>
								<img src="/assets/images/logo-header.png" alt="logo" className="w-100 img-fluid" />
							</div>
							<hr />
							<Form onSubmit={handleSubmit}>
								<Form.Group className='my-2' controlId="formBasicEmail">
									<Form.Label>Email address: </Form.Label>
									<Form.Control
										type="email"
										placeholder="Enter email"
										value={email}
										onChange={handleEmailChange}
										required
									/>
								</Form.Group>

								<Form.Group className='my-2' controlId="formBasicPassword">
									<Form.Label>Password:</Form.Label>
									<Form.Control
										type="password"
										placeholder="Password"
										value={password}
										onChange={handlePasswordChange}
										required
									/>
								</Form.Group>

								<Button className='w-100 my-2' variant="primary" type="submit" disabled={loading}>

									{loading ?
										<>
											<Spinner
												as="span"
												animation="border"
												size="sm"
												role="status"
												aria-hidden="true"
											/>
											<span>  Loading...</span>
										</>
										:
										'Login'
									}
								</Button>
							</Form>
						</Col>
					</Row>
				</Container>
			</div>
		</div>
	);
};

export default LoginPage;
