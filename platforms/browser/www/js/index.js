/* 
 * 
 * Set execution mode
 * Options:
 *      DEBUG
 *      RELACE
 */
var mode = "DEBUG"

if(mode == "DEBUG") {
    var rec_time = 6;
} else {
    var rec_time = 60;
}

var long_rec_time = 300;

var recorded_time = 0;

var offset = 3;
var offset_big = 10;
        
var path = "file:/storage/emulated/0/";
var srcFile = "prexor" + get_date() + ".amr";
var server_uri = "http://52.38.187.44/prexor/";

var $myFuelGauge;
var mediaRec = null;
var processInterval = null;
var data = {};
var resumen_data = "";
var recInterval = null;
var restarted = false;
var min_db = 0, max_db = 0, average_db = 0, temp_max_db = new Array(), tmp = 0, counter = 0;

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
        
        data = JSON.parse(localStorage.getItem('data'));
    
        if(data) {
            $.each(data, function(key, value){
                $("[name=" + key + "]").val(value);
            });
        } else {
            $("#modal_start").modal("show");
        }
        
    } catch (e) {

        alert("Web Audio API is not supported by this browser\n ... http://caniuse.com/#feat=audio-api");
    }
});

function average(arr) {
    var sum = 0;
    for( var i = 0; i < arr.length; i++ ){
        sum += parseInt( arr[i], 10 ); //don't forget to add the base
    }

    return sum/arr.length;
}

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
    max_db = Math.round(max_db * 100) / 100;
    
    if(counter >= 10) {
        counter = 0;
        tmp = 0;
        temp_max_db.push(max_db);
        if(min_db > 0) {
            min_db = Math.min(min_db, percentage);
            min_db = Math.round(min_db * 100) / 100;
        } else {
            min_db = Math.round(max_db);
        }
    } else {
        average_db = max_db;
        counter ++;
    }
    
    //$("#meter").html(max_db);
    $myRecGauge = $("div#fuel-gauge-record").dynameter({
      label: '',
      value: Math.round(eval(percentage) * 100) / 100,
      //value: Math.round((average_db + Math.random()) * 100) / 100,
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
function recordAudio(used_device) {
    if(used_device != "soundmeter") {
        $('#index').hide();
        $('#recording').show();
    }
    
    data = {
        id: "001",
        date: get_date(),
        position: "",
        loudness: 0,
        max_loudness: 0,
        min_loudness: 0,
        external_type: "",
        external_model: "",
        external_serial: "",
    };
    get_position(function(position) {
        
        data.position = position;
        
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
        resumen_data += '<div class="form-group">';
        resumen_data += '<div class="col-lg-10">';
        resumen_data += '<b>Longitud:</b> ' + position.longitude;
        resumen_data += '</div>';
        resumen_data += '</div>';
        
        $("#data").find(":input").each(function() {
            if(this.name == "submit") return true;
            var val;
            
            //if(this.name == "other_sources" || this.name == "other_afected" || this.name == "use_protection") {
            if(false) {
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
        
        if(used_device == "soundmeter") {
            $('#index').hide();
            record_external();
        } else {
            record();
        }
        
        localStorage.setItem('data', JSON.stringify(data));
    });
}

function record_external() {
    $('#index').hide();
    $("#external_measure").scrollTop(0);
    $("#external_data").validator();
    $('#external_measure').show();
}

function stop_record_external(e) {
    if(e.hasClass("disabled")) {
        bootbox.alert("Por favor completa todos los campos");
    } else {
        // Dummy data
        temp_max_db = [eval($("#external_result").val())];
        max_db = "N/A";
        min_db = "N/A";
        recorded_time = eval($("#external_duration").val());
        data.external_type = $("#external_type").val();
        data.external_model = $("#external_model").val();
        data.external_serial = $("#external_serial").val();
        uploadAudio(path + srcFile);
    }
}

function record() {
    if(mode != "DEBUG") {
        window.plugins.insomnia.keepAwake();
    }
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
        
    window.navigator.getUserMedia({audio: true}, function( stream ) {
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
        if (time == end_time) {
            stop_record();
        }
    }, 1000);
}

function stop_record() {
    $("#stop_record").hide();
    if(mode != "DEBUG") {
        window.plugins.insomnia.allowSleepAgain();
    }
    clearInterval(recInterval);
    onRecSuccess();
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
}

// onSuccess Callback
//
function onRecSuccess(mediaFiles) {
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
    uploadAudio(path + srcFile);
}

function onRecError(error) {
    alert('code: '    + error.code    + '\n' +
          'message: ' + error.message + '\n');
}

function uploadAudio(fileURL) { 
    /*
    var options = new FileUploadOptions(); 
    options.fileKey = "file"; 
    options.fileName = srcFile; 
    options.mimeType = "audio/wav";
    options.chunkedMode = false;
    var ft = new FileTransfer(); 
    ft.upload(fileURL, encodeURI(server_uri + "upload.php"), win, fail, options, true);
    */
   
    temp_max_db = temp_max_db.sort();
    average_db = Math.round(average(temp_max_db));
   
    clearInterval(processInterval);
    /*
    var id_data = '<div class="form-group">';
    id_data += '<div class="col-lg-10">';
    id_data += '<b>Identificador:</b> ' + data.id;
    id_data += '</div>';
    id_data += '</div>';
    */
    var id_data = '';
    if (Math.round(max_db) in values) {
        data.loudness = values[Math.round(max_db)][2];
        data.max_loudness = values[Math.round(max_db)][1];
        data.min_loudness = values[Math.round(max_db)][0];
    } else {
        data.loudness = Math.round(max_db);
        data.max_loudness = Math.round(max_db) + 3;
        data.min_loudness = Math.round(max_db) - 4;
    }
    
    
    id_data += '<div class="form-group">';
    id_data += '<div class="col-lg-10">';
    id_data += '<b>Nivel de ruido medido:</b> ' + data.loudness + " dB(A)";
    id_data += '<br /><b>Nivel maximo de ruido medido:</b> ' + data.max_loudness + " dB(A)";
    id_data += '<br /><b>Nivel minimo de ruido medido:</b> ' + data.min_loudness + " dB(A)";
    id_data += '</div>';
    id_data += '</div>';
    
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
    var minus = eval(data.min_loudness);
    var plus = eval(data.max_loudness);
    $("#spark_value").html(loud + " dB(A)");
    $("#spark_value_minus").html(Math.round(minus) + " dB(A)");
    $("#spark_value_plus").html(Math.round(plus) + " dB(A)");
    
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
    
    id_data += '<div class="form-group">';
    id_data += '<div class="col-lg-10">';
    id_data += '<b>Duración de la medición:</b> ' + data.time_interval + " segundos";
    id_data += '</div>';
    id_data += '</div>';
    
    resumen_data = id_data + resumen_data;
    
    setTimeout(function() {
        html2canvas($("#fuel-gauge"), { 
            onrendered: function(canvas) {
                data.image    = canvas.toDataURL("image/png");
                $(".sparkboxplotraw").sparkline([minus - 3,  minus, loud, plus, plus + 3],
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
    
    if($("#events_characteristics").val() == "Realizar medición con sonómetro externo") {
        if(resumen_data) {
            resumen_data += '<div class="form-group">';
            resumen_data += '<div class="col-lg-10">';
            resumen_data += '<b>Marca del sonómetro:</b> ' + data.external_type;
            resumen_data += '</div>';
            resumen_data += '</div>';
            resumen_data += '<div class="form-group">';
            resumen_data += '<div class="col-lg-10">';
            resumen_data += '<b>Modelo del sonómetro:</b> ' + data.external_model;
            resumen_data += '</div>';
            resumen_data += '</div>';
            resumen_data += '<div class="form-group">';
            resumen_data += '<div class="col-lg-10">';
            resumen_data += '<b>Número de serie sel sonómetro:</b> ' + data.external_serial;
            resumen_data += '</div>';
            resumen_data += '</div>';
        }
    }
    
    $("#restart_record").show();
    $('#recording').hide();
    $('#external_measure').hide();
    $("#result").scrollTop(0);
    $('#result').show();
} 

function win(r) {
    $.post(server_uri + "api/process_audio", {file_name: srcFile}, function(api_response) {
        if(api_response.type == "error") {
            alert(api_response.message);
            return false;
        } else {
            data.loudness = eval(api_response.loudness);
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
            //id_data += '<b>ID:</b> ' + data.id;
            id_data += '</div>';
            id_data += '</div>';
            resumen_data = id_data + resumen_data;
            resumen_data += '<div class="form-group">';
            resumen_data += '<div class="col-lg-10">';
            resumen_data += '<b>Nivel de ruido medido:</b> ' + data.loudness + " dB(A)";
            resumen_data += '</div>';
            resumen_data += '</div>';
            
            $("#audio_level").html(data.loudness + " dB(A)")
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
    $("#resumen").scrollTop(0);
    $("#resumen").show();
}

function save_resumen() {
    var conn_type = checkConnection();
    if(conn_type == 'No network connection'){
        bootbox.alert("Por favor conecte el equipo a internet para enviar el reporte a servidor.", function() {});
    } else {
        var dialog = bootbox.dialog({
            message: '<p class="text-center">Guardando medición usando ' + conn_type + '</p>',
            closeButton: false
        });
        $.post(server_uri + "api/save", data, function(api_response) {
            if(api_response.type == "error") {
                alert(api_response.message);
                return false;
            } else {
                bootbox.alert("Medición guardada con éxito", function() {
                    dialog.modal('hide');
                    $("#modal_clear_data").modal("show");
                });
            }
        });
    }
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
        if($("#events_characteristics").val() == "Realizar medición con sonómetro externo"){
            $("#myModalExternal").modal("show");
        } else {
            $("#myModal").modal("show");
        }
    }
}

function clear_data() {
    $("#data").find(":input").each(function() {
        if(this.name == "submit") return true;
        $(this).val("");
    });
    $("#external_data").find(":input").each(function() {
        if(this.name == "submit") return true;
        $(this).val("");
    });
    data = {};
    localStorage.setItem('data', JSON.stringify(data));
}

function resume(clear_form) {
    min_db = 0;
    max_db = 0;
    average_db = 0;
    temp_max_db = new Array();
    tmp = 0;
    counter = 0;
    
    if(clear_form == true) {
        clear_data();
    }
    $("#external_result").val("");
    $("#external_duration").val("");
    $("#resumen").hide();
    $("#restart_record").hide();
    $("#stop_record").hide();
    $("#fuel-gauge-record").hide();
    $("#info").html("Inicializando...");
    $('#recording').hide();
    $('#external_measure').hide();
    $("#index").scrollTop(0);
    $("#index").show();
}

function restart(dont_ask) {
    if(dont_ask == true) {
        $('#external_measure').hide();
        $("#index").scrollTop(0);
        $("#index").show();
    } else {
        bootbox.confirm("¿Está seguro de que desea eliminar la medición realizada?", function(result) {
            if(result) {
                $("#modal_clear_data").modal("show");
            }
        });
    }
}

function checkConnection() {
    if(mode == "DEBUG"){
        return 'WiFi';        
    }
    
    var networkState = navigator.connection.type;

    var states = {};
    states[Connection.UNKNOWN]  = 'Conexión desconocida';
    states[Connection.ETHERNET] = 'Ethernet';
    states[Connection.WIFI]     = 'WiFi';
    states[Connection.CELL_2G]  = '2G coneción';
    states[Connection.CELL_3G]  = '3G coneción';
    states[Connection.CELL_4G]  = '4G coneción';
    states[Connection.CELL]     = 'Coneción generica';
    states[Connection.NONE]     = 'No network connection';

    return states[networkState];
}