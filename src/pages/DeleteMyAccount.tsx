import { redirect } from 'next/navigation';
import React, { useState } from 'react';
import { Container, Form, Button, Row, Col } from 'react-bootstrap';

const AccountDeletionForm = () => {
  const [stage, setStage] = useState(1);
  const [userIdentifier, setUserIdentifier] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  let [timer, setTimer] = useState(0);

  let intervalTimer: any = null;

  const startTimer = () => {
    timer = 5 * 60;
    setTimer(timer);

    if (intervalTimer) {
      clearInterval(intervalTimer);
    };

    intervalTimer = setInterval(() => {
      timer--;
      console.log('Timer:', timer);
      if (timer >= 0) {
        setTimer(timer);
      }
    }, 1000);
  }


  const handleSubmit = async (event: any) => {
    event.preventDefault();

    if (!userIdentifier) {
      alert('Phone number or email is required');
      return;
    }

    if (stage === 1 && userIdentifier) {
      setLoading(true);
      let response = await fetch('/api/delete-user', {
        method: 'POST',
        body: JSON.stringify({ userIdentifier }),
        headers: {
          'Content-Type': 'application/json',
        },
      });
      setLoading(false);

      if (!response.ok) {
        const data = await response.json();
        alert('Failed: ' + data.message);
        return;
      } else {
        startTimer();
        setOtp('');
        alert('An OTP has been sent to your email or phone number');
        setStage(2);
      }
    } else if (stage === 2 && otp) {
      setLoading(true);
      let response = await fetch('/api/delete-user', {
        method: 'PUT',
        body: JSON.stringify({ otp, userIdentifier }),
        headers: {
          'Content-Type': 'application/json',
        },
      });
      setLoading(false);

      if (!response.ok) {
        const data = await response.json();
        alert('Failed to delete account:' + data.message);
        return;
      } else {
        alert('Account deleted successfully');
        window.location.replace('https://digigramventures.com');
      }
    }
  };

  return (
    <Container fluid className="py-3">
      <img width={60} className='m-3 ms-0' src="/assets/images/logo-header.png" alt="" />
      <h2>Delete Your Account</h2>
      <hr />
      <Form onSubmit={handleSubmit}>
        {
          stage === 1 && <Form.Group className="my-3" controlId="formUserIdentifier">
            <Form.Label>Phone Number or Email:</Form.Label>
            <Form.Control
              type="text"
              placeholder="Enter phone number or email"
              value={userIdentifier}
              onChange={(e) => setUserIdentifier(e.target.value)}
              required
            />
            <Form.Text className="text-muted">
              Enter the phone number or email associated with your account
            </Form.Text>
          </Form.Group>
        }
        {
          stage === 2 && <Form.Group className="my-3" controlId="formOtp">
            <Form.Label>OTP:</Form.Label>
            <Form.Control
              type="text"
              placeholder="Enter the OTP sent to your email or phone"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              required
            />
            <Form.Text className="text-muted">
              Please check your email or phone for the OTP. You may have to check your spam folder.
            </Form.Text>
          </Form.Group>
        }
        {
          stage === 1 && <Button disabled={loading} variant="primary" type="submit">
            Request OTP
          </Button>
        }

        {
          stage === 2 &&
          <>
            <Button disabled={loading} className='me-2' variant="danger" type="submit">
              Confirm
            </Button>


            <Button onClick={() => { setStage(1) }} disabled={timer > 0} variant="primary" type="button">
              Try again
              {
                timer > 0 && <span>(in {Math.floor(timer / 60)} minutes and {timer % 60} seconds)</span>
              }
            </Button>
          </>

        }
      </Form>
    </Container>
  );
};

export default AccountDeletionForm;
