// pages/index.js
import { Container, Typography, Button, Box } from '@mui/material';
import Head from 'next/head';
import Link from "next/link";

export default function Home() {
    return (
        <>
            <Head>
                <title>LogViewer</title>
                <meta name="description" content="Seamlessly explore and analyze your log files with our intuitive viewer. Effortlessly browse through logs, highlight specific entries, and enjoy a clean, responsive interface for efficient log management." />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <link rel="icon" href="/logo.png" />
            </Head>

            <main className="flex min-h-screen flex-col items-center justify-center p-4 bg-gray-100">
                <Container maxWidth="sm">
                    <Box sx={{ textAlign: 'center', mb: 4 }}>
                        <Typography variant="h1" component="h1" gutterBottom>
                            LogViewer
                        </Typography>
                        <Typography variant="h6" component="h2" paragraph>
                            Seamlessly explore and analyze your log files with our intuitive viewer. Effortlessly browse through logs, highlight specific entries, and enjoy a clean, responsive interface for efficient log management.
                        </Typography>
                        <Link href="/upload" passHref>
                            <Button variant="contained" color="primary">
                                Let&apos;s View
                            </Button>
                        </Link>
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
}
