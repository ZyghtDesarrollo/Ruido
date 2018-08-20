var rec_time = 60;
//var rec_time = 10;
var long_rec_time = 300;

var recorded_time = 0;

var offset = 3;
var offset_big = 10;
        
//var path = "file:/storage/emulated/0/";
var path = "Documents://";
var full_path = "";
var srcFile = "prexor" + Date.now() + ".wav";
//var srcFile = "blank.wav";
var server_uri = "http://52.38.187.44/prexor/";

var $myFuelGauge;
var mediaRec = null;
var processInterval = null;
var data = {};
var resumen_data = "";
var recInterval = null;
var restarted = false;
var max_db = 0;
var no_html5 = false;

var src = null, fftSize = 1024
, ac
, analyser
, volume
, timeData = new Uint8Array(fftSize)
, bar = document.querySelector('.bar');
      
// Wait for device API libraries to load
//
document.addEventListener("deviceready", onDeviceReady, false);

$(function() {
    try {

        window.AudioContext = window.AudioContext ||
            window.webkitAudioContext ||
            window.mozAudioContext ||
            window.oAudioContext ||
            window.msAudioContext;

        ac = new AudioContext();
        
        volume = ac.createGain();
        volume.gain.value = 0;

        //processor = ctx.createScriptProcessor(4096, 1, 1)
        analyser = ac.createAnalyser()
        analyser.fftSize = fftSize;
        
        navigator.getUserMedia = ( navigator.getUserMedia ||
                navigator.webkitGetUserMedia ||
                navigator.mozGetUserMedia ||
                navigator.msGetUserMedia);
    } catch (e) {

        alert("Web Audio API is not supported by this browser\n ... http://caniuse.com/#feat=audio-api");
    }
});

function draw() {
    var total = i = 0
      , percentage
      , float
      , rms
      , db;
    analyser.getByteTimeDomainData(timeData);
    while ( i < fftSize ) {
       float = ( timeData[i++] / 0x80 ) - 1;
       total += ( float * float );
    }
    rms = Math.sqrt(total / fftSize);
    db  = 20 * ( Math.log(rms) / Math.log(10) );
    // sanity check
    db = Math.max(-48, Math.min(db, 0));
    percentage = 100 + ( db * 2.083 );
    max_db = Math.max(max_db, percentage);
    max_db = Math.round(max_db * 100) / 100
    //$("#meter").html(max_db);
    $myRecGauge = $("div#fuel-gauge-record").dynameter({
      label: '',
      //value: Math.round(eval(percentage) * 100) / 100,
      value: Math.round((max_db + Math.random()) * 100) / 100,
      min: 0.0,
      max: 120.0,
      unit: 'dB (A)',
      regions: { // Value-keys and color-refs
        0: 'normal',
        70.0: 'warn',
        82.0: 'error'
    }
    });

    requestAnimationFrame(draw);
}

// Record audio
//
function recordAudio() {
    $('#index').hide();
    $('#recording').show();
    get_position(function(position) {
        
        data = {
            id: "001",
            date: get_date(),
            position: position,
            loudness: 0
        };
        
        resumen_data = '<div class="form-group">';
        resumen_data += '<div class="col-lg-10">';
        resumen_data += '<b>Fecha de la medición:</b> ' + data['date'];
        resumen_data += '</div>';
        resumen_data += '</div>';
        resumen_data += '<div class="form-group">';
        resumen_data += '<div class="col-lg-10">';
        resumen_data += '<b>Latitud:</b> ' + position.latitude;
        resumen_data += '</div>';
        resumen_data += '</div>';
        resumen_data += '<div class="col-lg-10">';
        resumen_data += '<b>Longitud:</b> ' + position.longitude;
        resumen_data += '</div>';
        resumen_data += '</div>';
        
        
        $("#data").find(":input").each(function() {
            if(this.name == "submit") return true;
            var val;
            if(this.name == "other_sources" || this.name == "other_afected" || this.name == "use_protection") {
                state = $(this).bootstrapSwitch('state')
                if(state) {
                    val = "Si";
                } else {
                    val = "No";
                }
            } else {
                if($(this).is(":disabled")) {
                    val = "";
                } else {
                    val = $(this).val();
                }
            }
            
            data[this.name] = val;
            
            resumen_data += '<div class="form-group">';
            resumen_data += '<div class="col-lg-10">';
            resumen_data += '<b>' + $(this).data("label") + ':</b> ' + val;
            resumen_data += '</div>';
            resumen_data += '</div>';
        });
        
        record();
    });
}

function record() {
    window.plugins.insomnia.keepAwake();
    var time = eval(rec_time);
    var end_time = 0;
    var multiplier = -1;
    recorded_time = 0;
    if($("#events_characteristics").val() == "Duración variable"){
        time = 0;
        end_time = eval(long_rec_time);
        multiplier = 1;
        $("#stop_record").show();
    } else {
        $("#stop_record").hide();
    }
    $('#info').html("Midiendo<br /><span id='subinfo'>" + time +" segundos</span>");
    
    try {        
        var navigator = window.navigator;
        navigator.getMedia = ( navigator.getUserMedia ||
                             navigator.webkitGetUserMedia ||
                             navigator.mozGetUserMedia ||
                             navigator.msGetUserMedia);

        navigator.getMedia({audio: true}, function( stream ) {
            src = ac.createMediaStreamSource(stream);
            src.connect(analyser);
            analyser.connect(volume);
            volume.connect(ac.destination);
            /*
            src.connect(analyser);
            analyser.connect(ac.destination);
            src.connect(ac.destination);
            */
            $("#restart_record").show();
            draw();
            $('#fuel-gauge-record').show();
        }, function( e ) {
          throw e;
        });

        recInterval = setInterval(function() {
            $('#subinfo').html(time + " segundos");
            time = time + multiplier;
            recorded_time += 1;
            if (time >= end_time) {
                stop_record();
            }
        }, 1000);
        
    } catch (e) {
        try {
            no_html5 = true;
            //mediaRec = new Media(srcFile, onRecSuccess, onRecError);
            // Record audio
            //mediaRec.startRecord();
            navigator.device.capture.captureAudio(onRecSuccess, onRecError, {limit: 1, duration: rec_time});
            recInterval = setInterval(function() {
                $('#subinfo').html(time + " segundos");
                time = time + multiplier;
                recorded_time += 1;
                if (time == end_time) {
                    stop_recording();
                }
            }, 1000);
        } catch (e) {
            alert(e);
        }
    }
}

function stop_record() {
    $("#stop_record").hide();
    window.plugins.insomnia.allowSleepAgain();
    clearInterval(recInterval);
    onRecSuccess();
}

function stop_recording() {
        clearInterval(recInterval);
        mediaRec.stopRecord();
        mediaRec = null;
    }

function restart_record() {
    $("#restart_record").prop("disabled", true);
    restarted = true;
    stop_record();
    record();
    $("#restart_record").prop("disabled", false);
}

// device APIs are available
//
function onDeviceReady() {
    //recordAudio();
    // For iOS
    window.requestFileSystem(LocalFileSystem.PERSISTENT, 0, gotFS, function fail(){});
}

var gotFS = function (fileSystem) {
    fileSystem.root.getFile(srcFile,
        { create: true, exclusive: false }, //create if it does not exist
        function success(entry) {
            full_path = entry.toURI();
            //alert(JSON.stringify(entry))
        },
        function fail() {}
    );
};

// onSuccess Callback
//
function onRecSuccess(mediaFiles) {
    try {
        clearInterval(recInterval);
        var i, path, len;
        for (i = 0, len = mediaFiles.length; i < len; i += 1) {
            path = mediaFiles[i].fullPath;
        }
        
        if(restarted) {
            restarted = false;
            return false;
        }
        $('#info').html("Procesando<br /><span id='subinfo'></span>");
        $("#restart_record").hide();
        $('#subinfo').html("");
        dots = "";
        processInterval = setInterval(function() {
            if(dots == "...") {
                dots = "";
            } else {
                dots = dots + ".";
            }
            $('#subinfo').html(dots);
        }, 500);
        uploadAudio(path);
        //uploadAudio(getPhoneGapPath() + srcFile);
        
    } catch(e) {
        alert(e)
    }
}

function getPhoneGapPath(){
    return path
    var path = window.location.pathname;
    path = path.substr( 0, path.length - 10 );
    return 'file://' + path;
};

function onRecError(error) {
    alert('code: '    + error.code    + '\n' +
          'message: ' + error.message + '\n');
}

function uploadAudio(fileURL) { 
    if(no_html5) {
        try {
            srcFile = fileURL.substr(fileURL.lastIndexOf('/') + 1);
            var options = new FileUploadOptions(); 
            options.fileKey = "file"; 
            options.fileName = srcFile;
            //options.mimeType = "audio/wav";
            //options.chunkedMode = false;
            var ft = new FileTransfer(); 
            //alert(srcFile);
            ft.upload(fileURL, encodeURI(server_uri + "upload.php"), win, fail, options, true);
        } catch(e) {
            alert(e)
        }
    } else {
        clearInterval(processInterval);
        var id_data = '<div class="form-group">';
        id_data += '<div class="col-lg-10">';
        id_data += '<b>Identificador:</b> ' + data.id;
        id_data += '</div>';
        id_data += '</div>';
        data.loudness = max_db;
        id_data += '<div class="form-group">';
        id_data += '<div class="col-lg-10">';
        id_data += '<b>Nivel de ruido medido:</b> ' + data.loudness + " dB(A)";
        id_data += '</div>';
        id_data += '</div>';
        resumen_data = id_data + resumen_data;

        $myFuelGauge = $("div#fuel-gauge").dynameter({
                label: '',
                value: eval(data.loudness),
                min: 0.0,
                max: 120.0,
                unit: 'dB (A)',
                regions: { // Value-keys and color-refs
                  0: 'normal',
                  70.0: 'warn',
                  82.0: 'error'
              }
          });
        clearInterval(processInterval);

        var loud = eval(data.loudness);
        $("#spark_value").html(loud + " dB(A)");
        $("#spark_value_minus").html(loud - offset + " dB(A)");
        $("#spark_value_plus").html(loud + offset + " dB(A)");

        data.time_interval = recorded_time;

        var minutes = Math.floor(recorded_time / 60);
        var seconds = recorded_time - minutes * 60;

        var time_text = "";

        if(minutes == 1) {
            time_text = minutes + " minuto ";
        } else if(minutes > 1) {
            time_text = minutes + " minutos ";
        }

        if(seconds > 0) {
            time_text += seconds + " segundos";
        }

        $("#audio_time_text").html(time_text);
        loud = Math.round(loud);

        setTimeout(function() {
            html2canvas($("#fuel-gauge"), { 
                onrendered: function(canvas) {
                    data.image    = canvas.toDataURL("image/png");
                    $(".sparkboxplotraw").sparkline([loud - offset_big,  loud - offset, loud, loud + offset, loud + offset_big],
                        {
                            type: 'box',
                            width: '300',
                            height: '20',
                            raw: false,
                            boxLineColor: '#000000',
                            boxFillColor: '#aaffaa',
                            whiskerColor: '#000000',
                            outlierLineColor: '#000000',
                            outlierFillColor: '#aaffaa',
                            medianColor: '#00bf5f'
                    });
                }
            });
        }, 100);

        $("#audio_level").html(data.loudness + " dB(A)")
        audio_level_text = "Tarea con probable nivel sobre 10 veces el límite permisible para 8 horas de exposición.";
        if(data.loudness <= 80) {
            audio_level_text = "Tarea de probable nivel bajo";
        } else if(data.loudness > 80 && data.loudness <= 82) {
            audio_level_text = "Tarea con probable nivel sobre criterio de exposición de 80 dB (A).";
        } else if(data.loudness > 82 && data.loudness <= 85) {
            audio_level_text = "Tarea con probable nivel sobre el criterio de acción de 82 dB(A).";
        } else if(data.loudness > 85 && data.loudness <= 95) {
            audio_level_text = "Tarea con probable nivel sobre el límite permisible para 8 horas de exposición.";
        }
        $("#audio_level_text").html(audio_level_text);

        $("#restart_record").show();
        $('#recording').hide();
        $('#result').show();
    }
} 

function win(r) {
    //alert("It's a win!");
    //alert("Code = " + r.responseCode);
    //alert("Response = " + r.response);
    //alert("Sent = " + r.bytesSent);
    $.post(server_uri + "api/process_audio", {file_name: srcFile}, function(api_response) {
        //alert(JSON.stringify(api_response))
        if(api_response.type == "error") {
            alert(api_response.message);
            return false;
        } else {
            data.loudness = eval(api_response.loudness);
            data.max_loudness = eval(api_response.loudness_max);
            //data.min_loudness = eval(api_response.loudness_min);
            data.min_loudness = 0;
            data.id = api_response.id;
            $myFuelGauge = $("div#fuel-gauge").dynameter({
                label: '',
                value: eval(data.loudness),
                min: 0.0,
                max: 120.0,
                unit: 'dB (A)',
                regions: { // Value-keys and color-refs
                  0: 'normal',
                  70.0: 'warn',
                  82.0: 'error'
              }
              });
            clearInterval(processInterval);
            var id_data = '<div class="form-group">';
            id_data += '<div class="col-lg-10">';
            id_data += '<b>ID:</b> ' + data.id;
            id_data += '</div>';
            id_data += '</div>';
            resumen_data = id_data + resumen_data;
            resumen_data += '<div class="form-group">';
            resumen_data += '<div class="col-lg-10">';
            resumen_data += '<b>Nivel de ruido medido:</b> ' + data.loudness + " dB(A)";
            resumen_data += '</div>';
            resumen_data += '</div>';
            
            $("#audio_level").html(data.loudness + " dB(A)");
            $("#audio_level_max").html(data.max_loudness + " dB(A)");
            //$("#audio_level_min").html(data.min_loudness + " dB(A)");
            
            audio_level_text = "Tarea con probable nivel sobre 10 veces el límite permisible para 8 horas de exposición.";
            if(data.loudness <= 80) {
                audio_level_text = "Tarea de probable nivel bajo";
            } else if(data.loudness > 80 && data.loudness <= 82) {
                audio_level_text = "Tarea con probable nivel sobre criterio de exposición de 80 dB (A).";
            } else if(data.loudness > 82 && data.loudness <= 85) {
                audio_level_text = "Tarea con probable nivel sobre el criterio de acción de 82 dB(A).";
            } else if(data.loudness > 85 && data.loudness <= 95) {
                audio_level_text = "Tarea con probable nivel sobre el límite permisible para 8 horas de exposición.";
            }
            $("#audio_level_text").html(audio_level_text);
            
            $('#recording').hide();
            $('#result').show();
        }
    });
} 

function fail(error) { 
    alert("An error has occurred: Code = " + error.code); 
    console.log("upload error source " + error.source); 
    console.log("upload error target " + error.target); 
}

function get_date() {
    var today = new Date();
    var dd = today.getDate();
    var mm = today.getMonth()+1; //January is 0!
    var yyyy = today.getFullYear();

    if(dd<10) {
        dd='0'+dd
    } 

    if(mm<10) {
        mm='0'+mm
    } 

    today = dd+'-'+mm+'-'+yyyy;

    return today;
}

function get_position(fn) {
    navigator.geolocation.getCurrentPosition(
        function(position) {
            fn({
                latitude: position.coords.latitude,
                longitude: position.coords.longitude
            });
        },
        function() {
            alert('Error getting location');
            fn(null);
        }
    );
}

function show_resumen() {
    $("#resumen_data").html(resumen_data);
    $("#result").hide();
    $("#resumen").show();
}

function save_resumen() {
    var dialog = bootbox.dialog({
        message: '<p class="text-center">Guardando medición</p>',
        closeButton: false
    });
    $.post(server_uri + "api/save", data, function(api_response) {
        if(api_response.type == "error") {
            alert(api_response.message);
            return false;
        } else {
            bootbox.alert("Medición guardada con éxito", function() {
                /*
                $("#data").find(":input").each(function() {
                     if(this.name == "submit") return true;
                     $(this).val("");
                });
                */
                dialog.modal('hide');
                $("#resumen").hide();
                $("#index").scrollTop(0);
                $("#index").show();
            });
        }
    });
}

function protection_changed(e) {
    var state = e.val() == "si";
    if(state) {
        $("#protection_type").prop("disabled", false);
        $("#protection_model").prop("disabled", false);
    } else {
        $("#protection_type").prop("disabled", true);
        $("#protection_model").prop("disabled", true);
    }
}

function initiate_process(e) {
    if(e.hasClass("disabled")) {
        bootbox.alert("Por favor completa todos los campos");
    } else {
        $("#myModal").modal("show");
    }
}

function restart() {
    bootbox.confirm("¿Está seguro de que desea eliminar la medición realizada?", function(result) {
        if(result) {
            $("#data").find(":input").each(function() {
                if(this.name == "submit") return true;
                $(this).val("");
            });
            $("#resumen").hide();
            $("#restart_record").hide();
            $("#stop_record").hide();
            $("#fuel-gauge-record").hide();
            $("#info").html("Inicializando...");
            $('#recording').hide();
            $("#index").scrollTop(0);
            $("#index").show();
        }
    });
}