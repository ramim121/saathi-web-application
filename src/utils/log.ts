import { NextApiResponse } from "next";

const logResponse = (res: NextApiResponse) => {
    const originalJson = res.json.bind(res);
    const originalStatusJson = res.status.bind(res);

    res.json = (data) => {
        console.log('Response JSON:', data);
        return originalJson(data);
    };

    res.status = (code) => {
        const statusRes = originalStatusJson(code);
        statusRes.json = (data) => {
            console.log('Response JSON:', data);
            return originalJson(data);
        };
        return statusRes;
    };
};

export default logResponse;