import { useEffect, useState, useCallback, useRef } from 'react';
import { Box, Typography, Button, MenuItem, Select, InputLabel } from '@mui/material';
import { VariableSizeList as List } from 'react-window';
import { getDatabaseNames, fetchLogsFromIndexedDB, deleteDatabase } from '../utils/indexedDB';
import Head from 'next/head';
import { useRouter } from 'next/router';

// 解析日期
const parseDate = (dateStr) => {
    let date;
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2},\d{3}$/.test(dateStr)) {
        date = new Date(dateStr.replace(',', '.').replace(' ', 'T'));
    } else if (/^\d{2}:\d{2}:\d{2},\d{3}$/.test(dateStr)) {
        const now = new Date();
        const [hours, minutes, seconds, milliseconds] = dateStr.split(/[:,]/);
        date = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, seconds, milliseconds);
    }
    return date;
};

// 查找最接近的记录
const findClosestLogIndex = (logs, targetTime) => {
    if (logs.length === 0) return null;

    let low = 0;
    let high = logs.length - 1;
    let closestIndex = -1;
    let smallestDiff = Infinity;

    while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        const logDate = parseDate(logs[mid].date);
        const logTime = logDate.getTime();
        const currentDiff = Math.abs(logTime - targetTime);

        if (currentDiff < smallestDiff) {
            smallestDiff = currentDiff;
            closestIndex = mid;
        }

        if (logTime < targetTime) {
            low = mid + 1;
        } else if (logTime > targetTime) {
            high = mid - 1;
        } else {
            break;
        }
    }

    return closestIndex;
};

const DisplayPage = () => {
    const [files, setFiles] = useState([]);
    const [selectedFiles, setSelectedFiles] = useState([]);
    const [logs, setLogs] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [highlightedIndexes, setHighlightedIndexes] = useState({});
    const listRefs = useRef({});
    const rowHeights = useRef({});
    const router = useRouter();

    useEffect(() => {
        const fetchFiles = async () => {
            try {
                const databaseNames = await getDatabaseNames();
                setFiles(databaseNames);
                setSelectedFiles([]);
            } catch (error) {
                setError('Error fetching database names');
            }
        };
        fetchFiles();
    }, []);

    useEffect(() => {
        const getLogs = async () => {
            if (selectedFiles.length > 0) {
                setLoading(true);
                try {
                    const fetchedLogs = {};
                    for (const file of selectedFiles) {
                        let logsFromDB = await fetchLogsFromIndexedDB(file);
                        logsFromDB.sort((a, b) => parseDate(a.date) - parseDate(b.date));
                        fetchedLogs[file] = logsFromDB;
                    }
                    setLogs(fetchedLogs);
                    setLoading(false);
                } catch (error) {
                    setError('Error fetching logs');
                    setLoading(false);
                }
            }
        };
        getLogs();
    }, [selectedFiles]);

    const handleFileChange = (event) => {
        const { value } = event.target;
        setSelectedFiles(typeof value === 'string' ? value.split(',') : value);
    };

    const handleDelete = async () => {
        if (selectedFiles.length === 0) return;
        try {
            for (const file of selectedFiles) {
                await deleteDatabase(file);
            }
            setFiles(files.filter(file => !selectedFiles.includes(file)));
            setSelectedFiles([]);
            setLogs({});
        } catch (error) {
            setError('Error deleting database');
        }
    };

    const rowRenderer = ({ index, style, data }) => {
        const { file } = data;
        const log = logs[file]?.[index];
        if (!log) {
            return null;
        }

        // 设置状态标签的样式
        const statusColors = {
            INFO: 'bg-green-200 text-green-800',
            WARN: 'bg-yellow-200 text-yellow-800',
            ERROR: 'bg-red-200 text-red-800'
        };

        return (
            <div
                style={style}
                className={`p-3 border-b border-gray-300 hover:bg-gray-100 cursor-pointer
                    ${highlightedIndexes[file] === index ? 'bg-yellow-100' : 'bg-transparent'}
                    transition-colors duration-1000 ease-out`}
                onClick={() => handleLogClick(log.date, file)}
            >
                <div className="max-h-44 overflow-y-auto break-words whitespace-pre-wrap">
                    <Typography variant="body2" color="textSecondary">
                        <strong>{log.date}</strong>
                        <span
                            className={`inline-block ml-2 px-2 py-1 rounded ${statusColors[log.status] || 'bg-transparent'}`}
                        >
                            {log.status}
                        </span>
                        : {log.content}
                    </Typography>
                </div>
            </div>
        );
    };

    const handleLogClick = (date, sourceFile) => {
        const clickedDate = parseDate(date);
        const clickedTime = clickedDate ? clickedDate.getTime() : NaN;
        console.log('Clicked time:', clickedTime);

        if (isNaN(clickedTime)) {
            console.log('Invalid date');
            return;
        }

        const newHighlightedIndexes = {};

        selectedFiles.forEach(file => {
            if (file === sourceFile) return;

            const fileLogs = logs[file] || [];
            const closestIndex = findClosestLogIndex(fileLogs, clickedTime);
            newHighlightedIndexes[file] = closestIndex;

            if (listRefs.current[file]) {
                listRefs.current[file].scrollToItem(closestIndex, 'center');
            }
        });

        setHighlightedIndexes(newHighlightedIndexes);

        setTimeout(() => {
            setHighlightedIndexes((prev) => {
                const updatedIndexes = { ...prev };
                for (const file of selectedFiles) {
                    if (updatedIndexes[file] !== undefined) {
                        updatedIndexes[file] = null;
                    }
                }
                return updatedIndexes;
            });
        }, 5000);
    };

    const getRowHeight = useCallback(index => {
        if (rowHeights.current[index] === undefined) {
            rowHeights.current[index] = 100; // Set a default row height
        }
        return rowHeights.current[index] + 100;
    }, []);

    const getMaxRows = useCallback(() => {
        const rowsCount = selectedFiles.reduce((max, file) => Math.max(max, logs[file]?.length || 0), 0);
        return rowsCount;
    }, [logs, selectedFiles]);

    return (
        <>
            <Head>
                <title>Upload Logs - LogViewer</title>
                <meta name="description" content="Upload and parse log files in LogViewer" />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <link rel="icon" href="/favicon.ico" />
            </Head>
            <Box className="p-4 bg-gray-50" sx={{ height: '100vh', overflow: 'hidden' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="h4" gutterBottom>
                        Log Records
                    </Typography>
                    <Button variant="contained" color="primary" onClick={() => router.push('/upload')}>
                        Back to Upload
                    </Button>
                </Box>
                <Box sx={{ mb: 2 }}>
                    <InputLabel>Choose Log Files</InputLabel>
                    <Select
                        multiple
                        value={selectedFiles}
                        onChange={handleFileChange}
                        renderValue={(selected) => selected.join(', ')}
                        fullWidth
                        sx={{ mb: 2 }}
                    >
                        {files.map((file, index) => (
                            <MenuItem key={index} value={file}>{file}</MenuItem>
                        ))}
                    </Select>
                    <Button variant="contained" color="error" onClick={handleDelete} className="mt-2">
                        Delete Selected Logs
                    </Button>
                </Box>
                {loading ? (
                    <Typography variant="body1">Loading...</Typography>
                ) : error ? (
                    <Typography variant="body1" color="error">
                        {error}
                    </Typography>
                ) : Object.keys(logs).length === 0 ? (
                    <Typography variant="body1">No logs available.</Typography>
                ) : (
                    <Box sx={{ display: 'flex', flexDirection: 'row', overflow: 'auto', height: 'calc(100% - 160px)' }}>
                        {selectedFiles.map((file) => (
                            <Box
                                key={file}
                                sx={{
                                    flex: 1,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    border: '1px solid #ddd',
                                    borderRadius: '4px',
                                    backgroundColor: '#fff',
                                    overflowY: 'auto',
                                    height: '100%',
                                    position: 'relative',
                                }}
                            >
                                <Typography variant="h6" sx={{ p: 1, borderBottom: '1px solid #ddd' }}>
                                    {file}
                                </Typography>
                                <List
                                    height={window.innerHeight - 160} // Adjust the height as needed
                                    width={window.innerWidth / selectedFiles.length - 10} // Adjust width as needed
                                    itemCount={logs[file]?.length || 0}
                                    itemSize={getRowHeight}
                                    itemData={{ file }}
                                    ref={ref => listRefs.current[file] = ref}
                                >
                                    {rowRenderer}
                                </List>
                            </Box>
                        ))}
                    </Box>
                )}
            </Box>
        </>
    );
};

export default DisplayPage;
