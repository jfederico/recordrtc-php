(function () {
    var params = {},
        r = /([^&=]+)=?([^&]*)/g;

    function d(s) {
        return decodeURIComponent(s.replace(/\+/g, ' '));
    }

    var search = window.location.search;
    var match = r.exec(search.substring(1));
    while (match) {
        params[d(match[1])] = d(match[2]);

        if (d(match[2]) === 'true' || d(match[2]) === 'false') {
            params[d(match[1])] = d(match[2]) === 'true' ? true : false;
        }
        match = r.exec(search.substring(1));
    }

    window.params = params;
})();

var recordingDIV = document.querySelector('.recordrtc');
var recordingMedia = recordingDIV.querySelector('.recording-media');
var recordingPlayer = recordingDIV.querySelector('video');
var mediaContainerFormat = recordingDIV.querySelector('.media-container-format');

recordingDIV.querySelector('button').onclick = function () {
    var button = this;

    if (button.innerHTML === 'Stop Recording') {
        button.disabled = true;
        button.disableStateWaiting = true;
        setTimeout(function () {
            button.disabled = false;
            button.disableStateWaiting = false;
        }, 2 * 1000);

        button.innerHTML = 'Star Recording';

        var stopStream = function () {
            if (button.stream && button.stream.stop) {
                button.stream.stop();
                button.stream = null;
            }
        }

        if (button.recordRTC) {
            if (button.recordRTC.length) {
                button.recordRTC[0].stopRecording(function (url) {
                    if (!button.recordRTC[1]) {
                        button.recordingEndedCallback(url);
                        stopStream();

                        saveToDiskOrOpenNewTab(button.recordRTC[0]);
                        return;
                    }

                    button.recordRTC[1].stopRecording(function (url) {
                        button.recordingEndedCallback(url);
                        stopStream();
                    });
                });
            } else {
                button.recordRTC.stopRecording(function (url) {
                    button.recordingEndedCallback(url);
                    stopStream();

                    saveToDiskOrOpenNewTab(button.recordRTC);
                });
            }
        }

        return;
    }

    button.disabled = true;

    var commonConfig = {
        onMediaCaptured: function (stream) {
            button.stream = stream;
            if (button.mediaCapturedCallback) {
                button.mediaCapturedCallback();
            }

            button.innerHTML = 'Stop Recording';
            button.disabled = false;
        },
        onMediaStopped: function () {
            button.innerHTML = 'Start Recording';

            if (!button.disableStateWaiting) {
                button.disabled = false;
            }
        },
        onMediaCapturingFailed: function (error) {
            if (error.name === 'PermissionDeniedError' && !!navigator.mozGetUserMedia) {
                InstallTrigger.install({
                    'Foo': {
                        // https://addons.mozilla.org/firefox/downloads/latest/655146/addon-655146-latest.xpi?src=dp-btn-primary
                        URL: 'https://addons.mozilla.org/en-US/firefox/addon/enable-screen-capturing/',
                        toString: function () {
                            return this.URL;
                        }
                    }
                });
            }

            commonConfig.onMediaStopped();
        }
    };

    if (recordingMedia.value === 'record-video') {
        captureVideo(commonConfig);

        button.mediaCapturedCallback = function () {
            button.recordRTC = RecordRTC(button.stream, {
                type: mediaContainerFormat.value === 'Gif' ? 'gif' : 'video',
                disableLogs: params.disableLogs || false,
                canvas: {
                    width: params.canvas_width || 320,
                    height: params.canvas_height || 240
                },
                frameInterval: typeof params.frameInterval !== 'undefined' ? parseInt(params.frameInterval) : 20 // minimum time between pushing frames to Whammy (in milliseconds)
            });

            button.recordingEndedCallback = function (url) {
                recordingPlayer.src = null;
                recordingPlayer.srcObject = null;

                if (mediaContainerFormat.value === 'Gif') {
                    recordingPlayer.pause();
                    recordingPlayer.poster = url;

                    recordingPlayer.onended = function () {
                        recordingPlayer.pause();
                        recordingPlayer.poster = URL.createObjectURL(button.recordRTC.blob);
                    };
                    return;
                }

                recordingPlayer.src = url;
                recordingPlayer.play();

                recordingPlayer.onended = function () {
                    recordingPlayer.pause();
                    recordingPlayer.src = URL.createObjectURL(button.recordRTC.blob);
                };
            };

            button.recordRTC.startRecording();
        };
    }

    if (recordingMedia.value === 'record-audio') {
        captureAudio(commonConfig);

        button.mediaCapturedCallback = function () {
            button.recordRTC = RecordRTC(button.stream, {
                type: 'audio',
                bufferSize: typeof params.bufferSize == 'undefined' ? 0 : parseInt(params.bufferSize),
                sampleRate: typeof params.sampleRate == 'undefined' ? 44100 : parseInt(params.sampleRate),
                leftChannel: params.leftChannel || false,
                disableLogs: params.disableLogs || false,
                recorderType: webrtcDetectedBrowser === 'edge' ? StereoAudioRecorder : null
            });

            button.recordingEndedCallback = function (url) {
                var audio = new Audio();
                audio.src = url;
                audio.controls = true;
                recordingPlayer.parentNode.appendChild(document.createElement('hr'));
                recordingPlayer.parentNode.appendChild(audio);

                if (audio.paused) {
                    audio.play();
                }

                audio.onended = function () {
                    audio.pause();
                    audio.src = URL.createObjectURL(button.recordRTC.blob);
                };
            };

            button.recordRTC.startRecording();
        };
    }

    if (recordingMedia.value === 'record-audio-plus-video') {
        captureAudioPlusVideo(commonConfig);

        button.mediaCapturedCallback = function () {

            if (webrtcDetectedBrowser !== 'firefox') { // opera or chrome etc.
                button.recordRTC = [];

                if (!params.bufferSize) {
                    // it fixes audio issues whilst recording 720p
                    params.bufferSize = 16384;
                }

                var audioRecorder = RecordRTC(button.stream, {
                    type: 'audio',
                    bufferSize: typeof params.bufferSize == 'undefined' ? 0 : parseInt(params.bufferSize),
                    sampleRate: typeof params.sampleRate == 'undefined' ? 44100 : parseInt(params.sampleRate),
                    leftChannel: params.leftChannel || false,
                    disableLogs: params.disableLogs || false,
                    recorderType: webrtcDetectedBrowser === 'edge' ? StereoAudioRecorder : null
                });

                var videoRecorder = RecordRTC(button.stream, {
                    type: 'video',
                    disableLogs: params.disableLogs || false,
                    canvas: {
                        width: params.canvas_width || 320,
                        height: params.canvas_height || 240
                    },
                    frameInterval: typeof params.frameInterval !== 'undefined' ? parseInt(params.frameInterval) : 20 // minimum time between pushing frames to Whammy (in milliseconds)
                });

                // to sync audio/video playbacks in browser!
                videoRecorder.initRecorder(function () {
                    audioRecorder.initRecorder(function () {
                        audioRecorder.startRecording();
                        videoRecorder.startRecording();
                    });
                });

                button.recordRTC.push(audioRecorder, videoRecorder);

                button.recordingEndedCallback = function () {
                    var audio = new Audio();
                    audio.src = audioRecorder.toURL();
                    audio.controls = true;
                    audio.autoplay = true;

                    audio.onloadedmetadata = function () {
                        recordingPlayer.src = videoRecorder.toURL();
                        recordingPlayer.play();
                    };

                    recordingPlayer.parentNode.appendChild(document.createElement('hr'));
                    recordingPlayer.parentNode.appendChild(audio);

                    if (audio.paused) {
                        audio.play();
                    }
                };
                return;
            }

            button.recordRTC = RecordRTC(button.stream, {
                type: 'video',
                disableLogs: params.disableLogs || false,
                // we can't pass bitrates or framerates here
                // Firefox MediaRecorder API lakes these features
            });

            button.recordingEndedCallback = function (url) {
                recordingPlayer.srcObject = null;
                recordingPlayer.muted = false;
                recordingPlayer.src = url;
                recordingPlayer.play();

                recordingPlayer.onended = function () {
                    recordingPlayer.pause();
                    recordingPlayer.src = URL.createObjectURL(button.recordRTC.blob);
                };
            };

            button.recordRTC.startRecording();
        };
    }

    if (recordingMedia.value === 'record-screen') {
        captureScreen(commonConfig);

        button.mediaCapturedCallback = function () {
            button.recordRTC = RecordRTC(button.stream, {
                type: mediaContainerFormat.value === 'Gif' ? 'gif' : 'video',
                disableLogs: params.disableLogs || false,
                canvas: {
                    width: params.canvas_width || 320,
                    height: params.canvas_height || 240
                }
            });

            button.recordingEndedCallback = function (url) {
                recordingPlayer.src = null;
                recordingPlayer.srcObject = null;

                if (mediaContainerFormat.value === 'Gif') {
                    recordingPlayer.pause();
                    recordingPlayer.poster = url;
                    recordingPlayer.onended = function () {
                        recordingPlayer.pause();
                        recordingPlayer.poster = URL.createObjectURL(button.recordRTC.blob);
                    };
                    return;
                }

                recordingPlayer.src = url;
                recordingPlayer.play();
            };

            button.recordRTC.startRecording();
        };
    }

    if (recordingMedia.value === 'record-audio-plus-screen') {
        captureAudioPlusScreen(commonConfig);

        button.mediaCapturedCallback = function () {
            button.recordRTC = RecordRTC(button.stream, {
                type: 'video',
                disableLogs: params.disableLogs || false,
                // we can't pass bitrates or framerates here
                // Firefox MediaRecorder API lakes these features
            });

            button.recordingEndedCallback = function (url) {
                recordingPlayer.srcObject = null;
                recordingPlayer.muted = false;
                recordingPlayer.src = url;
                recordingPlayer.play();

                recordingPlayer.onended = function () {
                    recordingPlayer.pause();
                    recordingPlayer.src = URL.createObjectURL(button.recordRTC.blob);
                };
            };

            button.recordRTC.startRecording();
        };
    }
};

function captureVideo(config) {
    captureUserMedia({
        video: true
    }, function (videoStream) {
        recordingPlayer.srcObject = videoStream;
        recordingPlayer.play();

        config.onMediaCaptured(videoStream);

        videoStream.onended = function () {
            config.onMediaStopped();
        };
    }, function (error) {
        config.onMediaCapturingFailed(error);
    });
}

function captureAudio(config) {
    captureUserMedia({
        audio: true
    }, function (audioStream) {
        recordingPlayer.srcObject = audioStream;
        recordingPlayer.play();

        config.onMediaCaptured(audioStream);

        audioStream.onended = function () {
            config.onMediaStopped();
        };
    }, function (error) {
        config.onMediaCapturingFailed(error);
    });
}

function captureAudioPlusVideo(config) {
    captureUserMedia({
        video: true,
        audio: true
    }, function (audioVideoStream) {
        recordingPlayer.srcObject = audioVideoStream;
        recordingPlayer.play();

        config.onMediaCaptured(audioVideoStream);

        audioVideoStream.onended = function () {
            config.onMediaStopped();
        };
    }, function (error) {
        config.onMediaCapturingFailed(error);
    });
}

function captureScreen(config) {
    getScreenId(function (error, sourceId, screenConstraints) {
        if (error === 'not-installed') {
            document.write('<h1><a target="_blank" href="https://chrome.google.com/webstore/detail/screen-capturing/ajhifddimkapgcifgcodmmfdlknahffk">Please install this chrome extension then reload the page.</a></h1>');
        }

        if (error === 'permission-denied') {
            alert('Screen capturing permission is denied.');
        }

        if (error === 'installed-disabled') {
            alert('Please enable chrome screen capturing extension.');
        }

        if (error) {
            config.onMediaCapturingFailed(error);
            return;
        }

        captureUserMedia(screenConstraints, function (screenStream) {
            recordingPlayer.srcObject = screenStream;
            recordingPlayer.play();

            config.onMediaCaptured(screenStream);

            screenStream.onended = function () {
                config.onMediaStopped();
            };
        }, function (error) {
            config.onMediaCapturingFailed(error);
        });
    });
}

function captureAudioPlusScreen(config) {
    getScreenId(function (error, sourceId, screenConstraints) {
        if (error === 'not-installed') {
            document.write('<h1><a target="_blank" href="https://chrome.google.com/webstore/detail/screen-capturing/ajhifddimkapgcifgcodmmfdlknahffk">Please install this chrome extension then reload the page.</a></h1>');
        }

        if (error === 'permission-denied') {
            alert('Screen capturing permission is denied.');
        }

        if (error === 'installed-disabled') {
            alert('Please enable chrome screen capturing extension.');
        }

        if (error) {
            config.onMediaCapturingFailed(error);
            return;
        }

        screenConstraints.audio = true;

        captureUserMedia(screenConstraints, function (screenStream) {
            recordingPlayer.srcObject = screenStream;
            recordingPlayer.play();

            config.onMediaCaptured(screenStream);

            screenStream.onended = function () {
                config.onMediaStopped();
            };
        }, function (error) {
            config.onMediaCapturingFailed(error);
        });
    });
}

function captureUserMedia(mediaConstraints, successCallback, errorCallback) {
    navigator.mediaDevices.getUserMedia(mediaConstraints).then(successCallback).catch(errorCallback);
}

function setMediaContainerFormat(arrayOfOptionsSupported) {
    var options = Array.prototype.slice.call(
        mediaContainerFormat.querySelectorAll('option')
    );

    var selectedItem;
    options.forEach(function (option) {
        option.disabled = true;

        if (arrayOfOptionsSupported.indexOf(option.value) !== -1) {
            option.disabled = false;

            if (!selectedItem) {
                option.selected = true;
                selectedItem = option;
            }
        }
    });
}

recordingMedia.onchange = function () {
    if (this.value === 'record-audio') {
        setMediaContainerFormat(['WAV', 'Ogg']);
        return;
    }
    setMediaContainerFormat(['WebM', /*'Mp4',*/ 'Gif']);
};

if (webrtcDetectedBrowser === 'edge') {
    // webp isn't supported in Microsoft Edge
    // neither MediaRecorder API
    // so lets disable both video/screen recording options

    console.warn('Neither MediaRecorder API nor webp is supported in Microsoft Edge. You cam merely record audio.');

    recordingMedia.innerHTML = '<option value="record-audio">Audio</option>';
    setMediaContainerFormat(['WAV']);
}

if (webrtcDetectedBrowser === 'firefox') {
    // Firefox implemented both MediaRecorder API as well as WebAudio API
    // Their MediaRecorder implementation supports both audio/video recording in single container format
    // Remember, we can't currently pass bit-rates or frame-rates values over MediaRecorder API (their implementation lakes these features)

    recordingMedia.innerHTML = '<option value="record-audio-plus-video">Audio+Video</option>' +
        '<option value="record-audio-plus-screen">Audio+Screen</option>' +
        recordingMedia.innerHTML;
}

// disabling this option because currently this demo
// doesn't supports publishing two blobs.
// todo: add support of uploading both WAV/WebM to server.
if (false && webrtcDetectedBrowser === 'chrome') {
    recordingMedia.innerHTML = '<option value="record-audio-plus-video">Audio+Video</option>' +
        recordingMedia.innerHTML;
    console.info('This RecordRTC demo merely tries to playback recorded audio/video sync inside the browser. It still generates two separate files (WAV/WebM).');
}

function saveToDiskOrOpenNewTab(recordRTC) {
    recordingDIV.querySelector('#save-to-disk').parentNode.style.display = 'block';
    recordingDIV.querySelector('#save-to-disk').onclick = function () {
        if (!recordRTC) return alert('No recording found.');

        recordRTC.save();
    };

    recordingDIV.querySelector('#open-new-tab').onclick = function () {
        if (!recordRTC) return alert('No recording found.');

        window.open(recordRTC.toURL());
    };

    recordingDIV.querySelector('#upload-to-server').disabled = false;
    recordingDIV.querySelector('#upload-to-server').onclick = function () {
        if (!recordRTC) return alert('No recording found.');
        this.disabled = true;

        var button = this;
        uploadToServer(recordRTC, function (progress, fileURL) {
            if (progress === 'ended') {
                button.disabled = false;
                button.innerHTML = 'Click to download from server';
                button.onclick = function () {
                    window.open(fileURL);
                };
                return;
            }
            button.innerHTML = progress;
        });
    };
}

var listOfFilesUploaded = [];

function uploadToServer(recordRTC, callback) {
    var blob = recordRTC instanceof Blob ? recordRTC : recordRTC.blob;
    var fileType = blob.type.split('/')[0] || 'audio';
    var fileName = (Math.random() * 1000).toString().replace('.', '');

    if (fileType === 'audio') {
        fileName += '.' + (!!navigator.mozGetUserMedia ? 'ogg' : 'wav');
    } else {
        fileName += '.webm';
    }

    // create FormData
    var formData = new FormData();
    formData.append(fileType + '-filename', fileName);
    formData.append(fileType + '-blob', blob);

    callback('Uploading ' + fileType + ' recording to server.');

    makeXMLHttpRequest('save.php', formData, function (progress) {
        if (progress !== 'upload-ended') {
            callback(progress);
            return;
        }

        var initialURL = location.href.replace(location.href.split('/').pop(), '') + 'uploads/';

        callback('ended', initialURL + fileName);

        // to make sure we can delete as soon as visitor leaves
        listOfFilesUploaded.push(initialURL + fileName);
    });
}

function makeXMLHttpRequest(url, data, callback) {
    var request = new XMLHttpRequest();
    request.onreadystatechange = function () {
        if (request.readyState == 4 && request.status == 200) {
            callback('upload-ended');
        }
    };

    request.upload.onloadstart = function () {
        callback('Upload started...');
    };

    request.upload.onprogress = function (event) {
        callback('Upload Progress ' + Math.round(event.loaded / event.total * 100) + "%");
    };

    request.upload.onload = function () {
        callback('progress-about-to-end');
    };

    request.upload.onload = function () {
        callback('progress-ended');
    };

    request.upload.onerror = function (error) {
        callback('Failed to upload to server');
        console.error('XMLHttpRequest failed', error);
    };

    request.upload.onabort = function (error) {
        callback('Upload aborted.');
        console.error('XMLHttpRequest aborted', error);
    };

    request.open('POST', url);
    request.send(data);
}

window.onbeforeunload = function () {
    recordingDIV.querySelector('button').disabled = false;
    recordingMedia.disabled = false;
    mediaContainerFormat.disabled = false;

    if (!listOfFilesUploaded.length) return;

    listOfFilesUploaded.forEach(function (fileURL) {
        var request = new XMLHttpRequest();
        request.onreadystatechange = function () {
            if (request.readyState == 4 && request.status == 200) {
                if (this.responseText === ' problem deleting files.') {
                    alert('Failed to delete ' + fileURL + ' from the server.');
                    return;
                }

                listOfFilesUploaded = [];
                alert('You can leave now. Your files are removed from the server.');
            }
        };
        request.open('POST', 'delete.php');

        var formData = new FormData();
        formData.append('delete-file', fileURL.split('/').pop());
        request.send(formData);
    });

    return 'Please wait few seconds before your recordings are deleted from the server.';
};
