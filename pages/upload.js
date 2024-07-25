// pages/upload.js
import { useState } from 'react';
import { Button, Typography, Box, Container } from '@mui/material';
import { saveLogToIndexedDB } from '../utils/indexedDB';
import Link from 'next/link';
import Head from 'next/head';

const UploadPage = () => {
    const [files, setFiles] = useState([]);
    const [message, setMessage] = useState('');

    const handleFileChange = (event) => {
        setFiles(Array.from(event.target.files));
    };

    const handleUpload = async () => {
        if (files.length === 0) {
            setMessage('请上传至少一个文件');
            return;
        }

        // 处理所有文件
        for (const file of files) {
            const fileName = file.name;
            const text = await file.text();
            const logs = parseLogs(text);
            await saveLogToIndexedDB(fileName, logs);
        }

        setMessage('所有文件已上传并解析成功');
    };

    const parseLogs = (text) => {
        const regex = /(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2},\d{3}|\d{2}:\d{2}:\d{2},\d{3})\s(INFO|WARN|ERROR)\s(.+)/g;
        const logs = [];
        let match;

        while ((match = regex.exec(text)) !== null) {
            logs.push({
                date: match[1],
                status: match[2],
                content: match[3]
            });
        }

        return logs;
    };

    return (
        <>
            <Head>
                <title>Upload Logs - LogViewer</title>
                <meta name="description" content="Upload and parse log files in LogViewer" />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <link rel="icon" href="/logo.png" />
            </Head>

            <main className="flex min-h-screen flex-col items-center justify-center p-4 bg-gray-100">
                <Container maxWidth="sm">
                    <Box sx={{ textAlign: 'center', mb: 4 }}>
                        <Typography variant="h4" component="h1" gutterBottom>
                            上传日志文件
                        </Typography>
                        <Typography variant="body1" paragraph>
                            选择一个或多个日志文件以便于将日志文件上传和解析。
                        </Typography>
                        <input
                            type="file"
                            accept=".slg"
                            multiple
                            onChange={handleFileChange}
                            className="my-4"
                        />
                        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2 }}>
                            <Button
                                variant="contained"
                                color="primary"
                                onClick={handleUpload}
                            >
                                上传并解析
                            </Button>
                            <Link href="/view" passHref>
                                <Button variant="outlined" color="secondary">
                                    查看日志
                                </Button>
                            </Link>
                        </Box>
                        {message && <Typography variant="body1" className="mt-4">{message}</Typography>}
                    </Box>
                </Container>
            </main>

            <footer className="flex items-center justify-center p-4 bg-gray-800 text-white">
                <Typography variant="body2" align="center">
                    &copy; {new Date().getFullYear()} ADVANTEST
                </Typography>
            </footer>
        </>
    );
};

export default UploadPage;
