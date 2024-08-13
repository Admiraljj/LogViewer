import { useEffect, useState, useCallback, useRef } from 'react';
import { Box, Typography, Button, MenuItem, Select, InputLabel, FormControl, FormControlLabel, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, TextField, IconButton } from '@mui/material';
import { VariableSizeList as List } from 'react-window';
import { getDatabaseNames, fetchLogsFromIndexedDB, deleteDatabase } from '../utils/indexedDB';
import Head from 'next/head';
import { useRouter } from 'next/router';
import SearchIcon from '@mui/icons-material/Search';
import ArrowBackIosIcon from '@mui/icons-material/ArrowBackIos';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';

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
    const [filterDialogOpen, setFilterDialogOpen] = useState(false);
    const [filterStatus, setFilterStatus] = useState('');
    const [filterContent, setFilterContent] = useState('');
    const [searchQueries, setSearchQueries] = useState({});
    const [searchIndexes, setSearchIndexes] = useState({});
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

    const handleReverse = () => {
        const reversedLogs = {};
        for (const file of selectedFiles) {
            const logsFromFile = logs[file] || [];
            reversedLogs[file] = logsFromFile.slice().reverse();
        }
        setLogs(reversedLogs);
    };

    const handleScrollToEnd = () => {
        for (const file of selectedFiles) {
            const listRef = listRefs.current[file];
            if (listRef) {
                listRef.scrollToItem(logs[file]?.length - 1, 'end');
            }
        }
    };

    const handleScrollToTop = () => {
        for (const file of selectedFiles) {
            const listRef = listRefs.current[file];
            if (listRef) {
                listRef.scrollToItem(0, 'start');
            }
        }
    };

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

        // 高亮关键词
        const highlightedContent = log.content.split(new RegExp(`(${searchQueries[file]})`, 'gi')).map((part, i) => (
            <span key={i} style={{ backgroundColor: searchQueries[file] && part.toLowerCase() === searchQueries[file].toLowerCase() ? 'yellow' : 'transparent' }}>
                {part}
            </span>
        ));

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
                        : {highlightedContent}
                    </Typography>
                </div>
            </div>
        );
    };

    const handleLogClick = (date, sourceFile) => {
        const clickedDate = parseDate(date);
        const clickedTime = clickedDate ? clickedDate.getTime() : NaN;

        if (isNaN(clickedTime)) {
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

    // 处理筛选对话框的打开和关闭
    const handleFilterDialogOpen = () => {
        setFilterDialogOpen(true);
    };

    const handleFilterDialogClose = () => {
        setFilterDialogOpen(false);
    };

// 处理筛选操作
    const handleFilter = async () => {
        if (selectedFiles.length > 0) {
            setLoading(true);
            try {
                const fetchedLogs = {};
                for (const file of selectedFiles) {
                    let logsFromDB = await fetchLogsFromIndexedDB(file);
                    logsFromDB.sort((a, b) => parseDate(a.date) - parseDate(b.date));
                    fetchedLogs[file] = logsFromDB.filter(log => {
                        return (
                            (!filterStatus || log.status === filterStatus) &&
                            (!filterContent || log.content.includes(filterContent))
                        );
                    });
                }
                setLogs(fetchedLogs);
                setLoading(false);
                handleFilterDialogClose();
            } catch (error) {
                setError('Error fetching logs');
                setLoading(false);
            }
        }
    };

    const handleCancelFilter = async () => {
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
                handleFilterDialogClose();
            } catch (error) {
                setError('Error fetching logs');
                setLoading(false);
            }
        }
    };

// 搜索功能
    const handleSearch = (file) => {
        if (searchQueries[file]) {
            const logEntries = logs[file] || [];
            const matchingIndexes = logEntries
                .map((log, index) => ({
                    index,
                    match: log.content.toLowerCase().includes(searchQueries[file].toLowerCase())
                }))
                .filter(entry => entry.match)
                .map(entry => entry.index);
            setSearchIndexes(prev => ({ ...prev, [file]: matchingIndexes }));

            // 设置初始高亮索引为第一个匹配项（可选）
            if (matchingIndexes.length > 0) {
                setHighlightedIndexes(prev => ({ ...prev, [file]: matchingIndexes[0] }));
            }
        } else {
            setSearchIndexes(prev => ({ ...prev, [file]: [] }));
            setHighlightedIndexes(prev => ({ ...prev, [file]: null }));
        }
    };


    const scrollToSearchIndex = (file, direction) => {
        const indexes = searchIndexes[file] || [];
        const currentHighlightedIndex = highlightedIndexes[file];

        const currentIndex = indexes.findIndex(index => index === currentHighlightedIndex);

        if (currentIndex === -1) {
            console.error('Current index not found in search indexes');
            return;
        }

        let newIndex;
        if (direction === 'prev') {
            newIndex = indexes[currentIndex - 1] !== undefined ? indexes[currentIndex - 1] : indexes[indexes.length - 1];
        } else if (direction === 'next') {
            newIndex = indexes[currentIndex + 1] !== undefined ? indexes[currentIndex + 1] : indexes[0];
        } else {
            console.error('Invalid direction:', direction);
            return;
        }

        setHighlightedIndexes(prev => ({ ...prev, [file]: newIndex }));

        const listRef = listRefs.current[file];
        if (listRef) {
            listRef.scrollToItem(newIndex, 'center');
        } else {
            console.error('List ref is not available for file:', file);
        }
    };


    return (
        <>
            <Head>
                <title>View Logs - LogViewer</title>
                <meta name="description" content="Upload and parse log files in LogViewer" />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <link rel="icon" href="/logo.png" />
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
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                        {files.map((file) => (
                            <FormControlLabel
                                key={file}
                                control={
                                    <Checkbox
                                        checked={selectedFiles.includes(file)}
                                        onChange={(event) => {
                                            const newSelectedFiles = [...selectedFiles];
                                            if (event.target.checked) {
                                                newSelectedFiles.push(file);
                                            } else {
                                                const index = newSelectedFiles.indexOf(file);
                                                if (index > -1) {
                                                    newSelectedFiles.splice(index, 1);
                                                }
                                            }
                                            setSelectedFiles(newSelectedFiles);
                                        }}
                                    />
                                }
                                label={file}
                                sx={{ whiteSpace: 'nowrap' }}
                            />
                        ))}
                    </Box>
                    <Button variant="contained" onClick={handleDelete} className="mt-2 mr-2 bg-red-500">
                        Delete Selected Logs
                    </Button>
                    <Button variant="contained" onClick={handleReverse} className="mt-2 ml-2 mr-2 bg-blue-500">
                        Reverse Logs
                    </Button>
                    <Button variant="contained" onClick={handleScrollToEnd} className="mt-2 ml-2 mr-2 bg-green-500">
                        Scroll to End
                    </Button>
                    <Button variant="contained" onClick={handleScrollToTop} className="mt-2 ml-2 mr-2 bg-green-500">
                        Scroll to Top
                    </Button>
                    <Button variant="contained" color="primary" onClick={handleFilterDialogOpen} disabled={selectedFiles.length === 0} className="mt-2 ml-2">
                        Filter Logs
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
                                <Box sx={{ display: 'flex', alignItems: 'center', p: 1, borderBottom: '1px solid #ddd' }}>
                                    <Typography variant="h6" sx={{ flex: 1 }}>
                                        {file}
                                    </Typography>
                                    <TextField
                                        variant="outlined"
                                        size="small"
                                        value={searchQueries[file] || ''}
                                        onChange={(e) => setSearchQueries(prev => ({ ...prev, [file]: e.target.value }))}
                                        placeholder="Search..."
                                    />
                                    <IconButton onClick={() => handleSearch(file)} size="small">
                                        <SearchIcon />
                                    </IconButton>
                                    <IconButton onClick={() => scrollToSearchIndex(file, 'prev')} size="small" disabled={!searchIndexes[file]?.length}>
                                        <ArrowBackIosIcon />
                                    </IconButton>
                                    <IconButton onClick={() => scrollToSearchIndex(file, 'next')} size="small" disabled={!searchIndexes[file]?.length}>
                                        <ArrowForwardIosIcon />
                                    </IconButton>
                                </Box>
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
            <Dialog open={filterDialogOpen} onClose={handleFilterDialogClose}>
                <DialogTitle>Filter Logs</DialogTitle>
                <DialogContent>
                    <FormControl fullWidth>
                        <InputLabel>Status</InputLabel>
                        <Select
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value)}
                        >
                            <MenuItem value="">All</MenuItem>
                            <MenuItem value="INFO">INFO</MenuItem>
                            <MenuItem value="WARN">WARN</MenuItem>
                            <MenuItem value="ERROR">ERROR</MenuItem>
                        </Select>
                    </FormControl>
                    <TextField
                        fullWidth
                        label="Content"
                        value={filterContent}
                        onChange={(e) => setFilterContent(e.target.value)}
                        margin="normal"
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleFilterDialogClose}>Cancel</Button>
                    <Button onClick={handleFilter} color="primary">Filter</Button>
                    <Button onClick={handleCancelFilter} color="warning">Clear Filter</Button>
                </DialogActions>
            </Dialog>
        </>
    );
}

export default DisplayPage;
