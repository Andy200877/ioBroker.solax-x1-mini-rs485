/* jshint -W097 */// jshint strict:false
/*jslint node: true */
"use strict";

const SerialPort = require("serialport");
const InterByteTimeout = require('@serialport/parser-inter-byte-timeout')
var sp = null;



// you have to require the utils module and call adapter function
const utils =  require('@iobroker/adapter-core'); // Get common adapter utils


// you have to call the adapter function and pass a options object
// name has to be set and has to be equal to adapters folder name and main file name excluding extension
// adapter will be restarted automatically every time as the configuration changed, e.g system.adapter.template.0

let adapter;
function startAdapter(options) {
     options = options || {};
     Object.assign(options, {
          name: 'solax-x1-mini-rs485',
          // is called when adapter shuts down - callback has to be called under any circumstances!
          unload: function (callback) {
            try {
                adapter.log.info('cleaned everything up...');
                callback();
            } catch (e) {
                callback();
            }
        },
        // is called if a subscribed object changes
        objectChange: function (id, obj) {
            // Warning, obj can be null if it was deleted
            adapter.log.info('objectChange ' + id + ' ' + JSON.stringify(obj));
        },
        // is called if a subscribed state changes
        stateChange: function (id, state) {
            // Warning, state can be null if it was deleted
            adapter.log.info('stateChange ' + id + ' ' + JSON.stringify(state));
        
            // you can use the ack flag to detect if it is status (true) or command (false)
            if (state && !state.ack) {
                adapter.log.info('ack is not set!');
            }
        },
        // is called when databases are connected and adapter received configuration.
        // start here!
        ready: () => {
      		main()
		}
     });
     adapter = new utils.Adapter(options);
     
     return adapter;
};

function getConfigObjects(Obj, where, what){
    var foundObjects = [];
    for (var prop in Obj){
        if (Obj[prop][where] == what){
            foundObjects.push(Obj[prop]);
        }
    }
    return foundObjects;
}
function round(value, digits) //digits 1 for 1 digit after comma
{
	var factor = Math.pow(10, digits);
	value = Math.round(value*factor);
	return value/factor;
}





function write_cmd(command){
	
	adapter.log.info('Gesendet : ' + command.toString('hex'));

            sp.write(command, function(err) {
                if (err) {
                    return adapter.log.error('Error on write: ', err.message);
                    }
                adapter.log.info('message to USB-stick written : ' + command);
            });


        }

function main() {

    // The adapters config (in the instance object everything under the attribute "native") is accessible via
    // adapter.config:
	var tty = adapter.config.tty;
	var timeout = adapter.config.timeout * 1000;
	var senddiscovery = Buffer.from([0xaa, 0x55, 0x01, 0x00, 0x00, 0x00, 0x10, 0x00, 0x00, 0x01, 0x10]);
	var sendinit = Buffer.from([0xaa, 0x55, 0x00, 0x00, 0x00, 0x00, 0x10, 0x01, 0x0f, 0x31, 0x32, 0x33, 0x34, 0x35, 0x36, 0x37, 0x37, 0x36, 0x35, 0x34, 0x33, 0x32, 0x31, 0x0a, 0x04, 0x01]);
	var sendinfo = Buffer.from([0xaa, 0x55, 0x01, 0x00, 0x00, 0x0a, 0x11, 0x03, 0x00, 0x01, 0x1e]);
	var sendlive = Buffer.from([0xaa, 0x55, 0x01, 0x00, 0x00, 0x0a, 0x11, 0x02, 0x00, 0x01, 0x1d]);
	var step = 0;
	var befehl = '';
	var antworterhalten = 0;
	var informationen = '';
	var Info_Data_hex = [];
	var Info_Data_ascii = [];
	var Live_Data_hex = [];
	var Live_Data_ascii = [];
	global.Wechselrichter = '';
	var count_offline = 0;
	
	var Info_Beschreibung = ['Device Type', 'rated Power', 'Firmware Version', 'Modul Name', 'Hersteller', 'Seriennummer', 'Rated Bus Voltage'];
	var Info_Objekt = ['DeviceType', 'ratedPower', 'FirmwareVersion', 'ModulName', 'Manufacturer', 'Serialnumber', 'RatedBusVoltage'];
	var Live_Beschreibung = ['Temperatur', 'Produktion heute', 'PV1 Spannung', 'PV2 Spannung', 'PV1 Strom', 'PV2 Strom', 'PV1 Leistung', 'PV2 Leistung', 'AC Strom', 'AC Spannung', 'AC Frequenz', 'AC Leistung', 'Produktion gesamt', 'Laufzeit gesamt', 'Modus', 'Fehler Netzspannung', 'Fehler Netzfrequenz', 'DC Einspeisefehler', 'Temperaturfehler', 'Fehlerhafte PV1 Spannung', 'Fehlerhafte PV2 Spannung', 'GFC-Fehler', 'Fehlermeldung', 'Modus Text', 'Fehler Text'];
	var Live_Objekt = ['Temperature', 'EnergyToday', 'PV1-Voltage', 'PV2-Voltage', 'PV1-Current', 'PV2-Current', 'PV1-Power', 'PV2-Power', 'AC-Current', 'AC-Voltage', 'AC-Frequency', 'AC-Power', 'EnergyTotal', 'RuntimeTotal','Mode', 'GridVoltageFault', 'GridFreqFault', 'DCinjectionFault', 'TemperatureFault', 'PV1VoltageFault', 'PV2VoltageFault', 'GFCfault', 'ErrorMessage', 'ModeText', 'ErrorMessageJson'];
	



	adapter.log.info('start of main');
    adapter.log.info('configured port : ' + tty );
	adapter.log.info('configured timeout (ms): ' + timeout );
	
	
    const sp = new SerialPort(tty || '/dev/ttyUSB1', { baudRate: 9600 }, function (error) {
		if ( error ) {
			adapter.log.error('failed to open: '+error);
			adapter.setState('info.connection', false, true);
        } else {
            adapter.log.info('open');
			adapter.setState('info.connection', true, true);
			
			const parser = sp.pipe(new InterByteTimeout({interval: 30}));
	
			parser.on('data', (data) => {
				var antwort = data.toString('hex');
				
				
				if (antwort.slice(0, 18) == 'aa5500ff010010800e' && antwort.length == 50) {
					antworterhalten = 1;
					var wrserial = antwort.slice(18,46);
					adapter.log.info ("Wechselrichter : '" + wrserial + "' gefunden...");
					step = 2;
				}
					
				if (antwort == 'aa55000a00001081010601a1' && antwort.length == 24) {
					antworterhalten = 1;
					adapter.log.info('Wechselrichter hat Init-Befehl akzeptiert.');
					step = 3;
				}

				if (antwort.slice(0, 18) == 'aa55000a010011833a' && antwort.length == 138) {
					antworterhalten = 1;
					adapter.log.info('Wechselrichter hat Info Befehl akzeptiert.');
					step = 4;
					
					informationen = antwort.slice(18,134);
					adapter.log.debug (" Informationen : '" + informationen + "' (" + informationen.length + ")" );
					Info_Data_hex[0] = informationen.slice(0,2)
					Info_Data_hex[1] = informationen.slice(2,14)
					Info_Data_hex[2] = informationen.slice(14,24)
					Info_Data_hex[3] = informationen.slice(24,52)
					Info_Data_hex[4] = informationen.slice(52,80)
					Info_Data_hex[5] = informationen.slice(80,108)
					Info_Data_hex[6] = informationen.slice(108,116)
					
					//Info_Data_ascii[0] = hex2a(Info_Data_hex[0]);
					Info_Data_ascii[0]  = Buffer.from(Info_Data_hex[0], 'hex').readUIntBE(0,1);					
					Info_Data_ascii[1] = hex2a(Info_Data_hex[1]);
					Info_Data_ascii[2] = hex2a(Info_Data_hex[2]);
					Info_Data_ascii[3] = hex2a(Info_Data_hex[3]);
					Info_Data_ascii[4] = hex2a(Info_Data_hex[4]);
					Info_Data_ascii[5] = hex2a(Info_Data_hex[5]);
					Info_Data_ascii[6] = hex2a(Info_Data_hex[6]);


					for (var count = 0; count < Info_Data_hex.length; count++) {
						adapter.log.debug (Info_Beschreibung[count] + " = '" + Info_Data_hex[count] + "' (" + Info_Data_hex[count].length + ") (" + Info_Data_ascii[count] + ")");
					}

					if (Wechselrichter == '') {
						global.Wechselrichter = Info_Data_ascii[5];
						create_wr(Info_Beschreibung, Info_Objekt, Live_Beschreibung, Live_Objekt)
						
						timeout = setTimeout(async function () {
							update_Info_data(Info_Data_hex, Info_Data_ascii, Info_Objekt)
						}, 1000);
					} else {
						update_Info_data(Info_Data_hex, Info_Data_ascii, Info_Objekt)
					}
						
					
					
					
					
					
				}
				
				
				if (antwort.slice(0, 18) == 'aa55000a0100118234' && antwort.length == 126) {
					informationen = antwort.slice(18,122);
					adapter.log.debug (" Informationen : '" + informationen + "' (" + informationen.length + ")" );
					antworterhalten = 1;
					adapter.log.info('Wechselrichter hat Live Befehl akzeptiert.');
					step = 4;
					
					Live_Data_hex[0]  = informationen.slice(0,4)
					Live_Data_ascii[0]  = Buffer.from(Live_Data_hex[0], 'hex').readUIntBE(0,2);  // temperatur
					
					Live_Data_hex[1]  = informationen.slice(4,8)
					Live_Data_ascii[1]  = Buffer.from(Live_Data_hex[1], 'hex').readUIntBE(0,2);  // energy today
					Live_Data_ascii[1] = Math.round((parseFloat(Live_Data_ascii[1]) * 0.1)*10)/10
					
					Live_Data_hex[2]  = informationen.slice(8,12)
					Live_Data_ascii[2]  = Buffer.from(Live_Data_hex[2], 'hex').readUIntBE(0,2);  // PV1 Voltage
					Live_Data_ascii[2] = Math.round((parseFloat(Live_Data_ascii[2]) * 0.1)*10)/10

					Live_Data_hex[3]  = informationen.slice(12,16)
					Live_Data_ascii[3]  = Buffer.from(Live_Data_hex[3], 'hex').readUIntBE(0,2);  // PV2 Voltage
					Live_Data_ascii[3] = Math.round((parseFloat(Live_Data_ascii[3]) * 0.1)*10)/10

					Live_Data_hex[4]  = informationen.slice(16,20)
					Live_Data_ascii[4]  = Buffer.from(Live_Data_hex[4], 'hex').readUIntBE(0,2);  // pv1 current
					Live_Data_ascii[4] = Math.round((parseFloat(Live_Data_ascii[4]) * 0.1)*10)/10

					Live_Data_hex[5]  = informationen.slice(20,24)
					Live_Data_ascii[5]  = Buffer.from(Live_Data_hex[5], 'hex').readUIntBE(0,2);  // pv2 current
					Live_Data_ascii[5] = Math.round((parseFloat(Live_Data_ascii[5]) * 0.1)*10)/10

					Live_Data_ascii[6]  = Live_Data_ascii[2] * Live_Data_ascii[4];               // PV1 Power
					Live_Data_ascii[6] = Math.round((parseFloat(Live_Data_ascii[6]) * 1)*10)/10
					Live_Data_hex[6] = decimalToHex(Live_Data_ascii[6],4);

					Live_Data_ascii[7]  = Live_Data_ascii[3] * Live_Data_ascii[5];               // PV2 Power
					Live_Data_ascii[7] = Math.round((parseFloat(Live_Data_ascii[7]) * 1)*10)/10
					Live_Data_hex[7] = decimalToHex(Live_Data_ascii[7],4);
					
					Live_Data_hex[8]  = informationen.slice(24,28)
					Live_Data_ascii[8]  = Buffer.from(Live_Data_hex[8], 'hex').readUIntBE(0,2);  // ac current
					Live_Data_ascii[8] = Math.round((parseFloat(Live_Data_ascii[8]) * 0.1)*10)/10
					
					Live_Data_hex[9]  = informationen.slice(28,32)
					Live_Data_ascii[9]  = Buffer.from(Live_Data_hex[9], 'hex').readUIntBE(0,2);  // ac voltage
					Live_Data_ascii[9] = Math.round((parseFloat(Live_Data_ascii[9]) * 0.1)*10)/10
					
					Live_Data_hex[10]  = informationen.slice(32,36)
					Live_Data_ascii[10]  = Buffer.from(Live_Data_hex[10], 'hex').readUIntBE(0,2);  // ac frequency
					Live_Data_ascii[10] = Math.round((parseFloat(Live_Data_ascii[10]) * 0.01)*10)/10
					
					Live_Data_hex[11] = informationen.slice(36,40)
					Live_Data_ascii[11]  = Buffer.from(Live_Data_hex[11], 'hex').readUIntBE(0,2);  // ac power
					
//					Live_Data_hex[12] = informationen.slice(40,44) // unused
//					Live_Data_ascii[12] = Buffer.from(Live_Data_hex[12], 'hex').readUIntBE(0,2); // unused
					
					Live_Data_hex[12] = informationen.slice(44,52)
					Live_Data_ascii[12] = Buffer.from(Live_Data_hex[12], 'hex').readUIntBE(0,4); // energy total
					Live_Data_ascii[12] = Math.round((parseFloat(Live_Data_ascii[12]) * 0.1)*10)/10
										
					Live_Data_hex[13] = informationen.slice(52,60)
					Live_Data_ascii[13] = Buffer.from(Live_Data_hex[13], 'hex').readUIntBE(0,4); // runtime total
										
					Live_Data_hex[14] = informationen.slice(60,64)
					Live_Data_ascii[14] = Buffer.from(Live_Data_hex[14], 'hex').readUIntBE(0,2); // mode
					
					Live_Data_hex[15] = informationen.slice(64,68)
					Live_Data_ascii[15] = Buffer.from(Live_Data_hex[15], 'hex').readUIntBE(0,2); // grid voltage fault
					Live_Data_ascii[15] = Math.round((parseFloat(Live_Data_ascii[15]) * 0.1)*10)/10
					
					Live_Data_hex[16] = informationen.slice(68,72)
					Live_Data_ascii[16] = Buffer.from(Live_Data_hex[16], 'hex').readUIntBE(0,2); // grid freq  fault
					Live_Data_ascii[16] = Math.round((parseFloat(Live_Data_ascii[16]) * 0.01)*10)/10
					
					Live_Data_hex[17] = informationen.slice(72,76)
					Live_Data_ascii[17] = Buffer.from(Live_Data_hex[17], 'hex').readUIntBE(0,2); // dc injection fault
					
					Live_Data_hex[18] = informationen.slice(76,80)
					Live_Data_ascii[18] = Buffer.from(Live_Data_hex[18], 'hex').readUIntBE(0,2); // temperature fault
					
					Live_Data_hex[19] = informationen.slice(80,84)
					Live_Data_ascii[19] = Buffer.from(Live_Data_hex[19], 'hex').readUIntBE(0,2); // pv1 voltage fault
					Live_Data_ascii[19] = Math.round((parseFloat(Live_Data_ascii[19]) * 0.1)*10)/10
					
					Live_Data_hex[20] = informationen.slice(84,88)
					Live_Data_ascii[20] = Buffer.from(Live_Data_hex[20], 'hex').readUIntBE(0,2); // pv2 voltage fault
					Live_Data_ascii[20] = Math.round((parseFloat(Live_Data_ascii[20]) * 0.1)*10)/10
					
					Live_Data_hex[21] = informationen.slice(88,92)
					Live_Data_ascii[21] = Buffer.from(Live_Data_hex[21], 'hex').readUIntBE(0,2); // gfc fault
					
					Live_Data_hex[22] = informationen.slice(92,100)
					Live_Data_ascii[22] = Buffer.from(Live_Data_hex[22], 'hex').readUIntLE(0,4); // error message
					Live_Data_ascii[22] = Live_Data_hex[22]
					
					//adapter.log.error ( "Error Meldung Text : '" +  error_text(Buffer.from(Live_Data_hex[22], 'hex').readUIntLE(0,4)) + "'");
					
					if (Live_Data_ascii[14] == '0') { Live_Data_ascii[23] = "waiting"; }
					if (Live_Data_ascii[14] == '1') { Live_Data_ascii[23] = "checking"; }
					if (Live_Data_ascii[14] == '2') { Live_Data_ascii[23] = "working"; }
					if (Live_Data_ascii[14] == '3') { Live_Data_ascii[23] = "failure"; }
					Live_Data_hex[23] = "00";
					Live_Data_hex[24] = Live_Data_hex[22]
					Live_Data_ascii[24] = error_text(Buffer.from(Live_Data_hex[22], 'hex').readUIntLE(0,4));
					
					
					
					
//					Live_Data_hex[24] = informationen.slice(100,104) // unused
//					Live_Data_ascii[24] = Buffer.from(Live_Data_hex[24], 'hex').readUIntBE(0,2); // unknown
					
					for (var count = 0; count < Live_Data_hex.length; count++) {
						adapter.log.debug (count + ".) " + Live_Beschreibung[count] + " = '" + Live_Data_hex[count] + "' (" + Live_Data_hex[count].length + ") (" + Live_Data_ascii[count] + ")");
					}
					
					
					
					

					
									
					if (Wechselrichter != '') {
						update_Live_data(Live_Data_hex, Live_Data_ascii, Live_Objekt)
						adapter.log.debug("Wechselrichter bekannt mache Update der Livedaten.");
						
					} else {
						adapter.log.info("Kein Wechselrichter bekannt !! KEIN Update der Livedaten möglich.");
					}

				}
				
				if (antworterhalten == 0) {
					adapter.log.info("recv unknown data = '" + antwort + "' (" + antwort.length + ")");
				}
				
				if (antworterhalten == 1) {
					count_offline = 0;
					if (Wechselrichter != '') {
						adapter.setState(Wechselrichter + '.Online', true, true);
					}
				}
			});
			
			
			
			var Intervall = setInterval(async function () {
				
//				adapter.log.info ('Antwort erhalten : ' + antworterhalten);
			
				if (antworterhalten == 0) {
					step ++;
					count_offline ++;
					
					if (Wechselrichter != '') {
						adapter.setState(Wechselrichter + '.Online', false, true);
						
						if (count_offline == 6) {
							adapter.log.info("Der Wechselrichter hat 5x nicht geantwortet. Er scheint offline zu sein. Setzte nun die Livedaten auf 0");
							live_daten_auf_null()
						}
					}
				}
				
				
				
				
				if (step == 5) { step = 1; }
				
				if (step == 1) {
					var log_befehl = "Step ist 1 => sende Discovery => ";
					befehl = senddiscovery;
				} else if (step == 2) {
					var log_befehl = "Step ist 2 => sende Init => ";
					befehl = sendinit;
				} else if (step == 3) {
					var log_befehl = "Step ist 3 => sende Info => ";
					befehl = sendinfo;
				} else if (step == 4) {
					var log_befehl = "Step ist 4 => sende Live => ";
					befehl = sendlive;
				}
				sp.write(befehl, (err) => {
					if (err) {
						return adapter.log.error(log_befehl + 'Error on write: ', err.message)
					}
				adapter.log.info(log_befehl + 'Nachricht verschickt.')
				antworterhalten = 0;
				});
				
			}, timeout);

        }
    });


    // in this template all states changes inside the adapters namespace are subscribed
    //adapter.subscribeStates('*');



}


function error_text(mask) {
	var ERRORS = ['Tz Protection Fault',
    'Mains Lost Fault',
    'Grid Voltage Fault',
    'Grid Frequency Fault',
    "PLL Lost Fault",
    "Bus Voltage Fault",
    "Error Bit 06",          // Byte 0.6
    "Oscillator Fault",      // Byte 0.7

    "DCI OCP Fault",           // Byte 1.0
    "Residual Current Fault",  // Byte 1.1
    "PV Voltage Fault",        // Byte 1.2
    "Ac10Mins Voltage Fault",  // Byte 1.3
    "Isolation Fault",         // Byte 1.4
    "Over Temperature Fault",  // Byte 1.5
    "Ventilator Fault",        // Byte 1.6
    "Error Bit 15",            // Byte 1.7

    "SPI Communication Fault",        // Byte 2.0
    "SCI Communication Fault",        // Byte 2.1
    "Error Bit 18",                   // Byte 2.2
    "Input Configuration Fault",      // Byte 2.3
    "EEPROM Fault",                   // Byte 2.4
    "Relay Fault",                    // Byte 2.5
    "Sample Consistence Fault",       // Byte 2.6
    "Residual-Current Device Fault",  // Byte 2.7

    "Error Bit 24",        // Byte 3.0
    "Error Bit 25",        // Byte 3.1
    "Error Bit 26",        // Byte 3.2
    "Error Bit 27",        // Byte 3.3
    "Error Bit 28",        // Byte 3.4
    "DCI Device Fault",    // Byte 3.5
    "Other Device Fault",  // Byte 3.6
    "Error Bit 31",        // Byte 3.7
	];
	var first = true;
	var errors_list = "";
	var anzahl = 0;
	
	if (mask) {
		for (var i = 0; i < 32; i++) {
			if (mask & (1 << i)) {
				anzahl ++;
              if (first) {
                  first = false;
                  errors_list += "["
                  } else {
                      errors_list += "," ;
                      }
                errors_list += '{"nr":';
                errors_list += anzahl;
                errors_list += ',"error":"';
                errors_list += ERRORS[i];
                errors_list += '"}';
                }
        }
        errors_list += ']';
    }

  return errors_list;
}


function live_daten_auf_null() {

	adapter.setState(Wechselrichter + '.Live.Temperature', 0, true);
	//adapter.setState(Wechselrichter + '.Live.EnergyToday', 0, true);
	adapter.setState(Wechselrichter + '.Live.PV1-Voltage', 0, true);
	adapter.setState(Wechselrichter + '.Live.PV2-Voltage', 0, true);
	adapter.setState(Wechselrichter + '.Live.PV1-Current', 0, true);
	adapter.setState(Wechselrichter + '.Live.PV2-Current', 0, true);
	adapter.setState(Wechselrichter + '.Live.PV1-Power', 0, true);
	adapter.setState(Wechselrichter + '.Live.PV2-Power', 0, true);
	adapter.setState(Wechselrichter + '.Live.AC-Current', 0, true);
	adapter.setState(Wechselrichter + '.Live.AC-Voltage', 0, true);
	adapter.setState(Wechselrichter + '.Live.AC-Frequency', 0, true);
	adapter.setState(Wechselrichter + '.Live.AC-Power', 0, true);
	//adapter.setState(Wechselrichter + '.Live.EnergyTotal', 0, true);
	//adapter.setState(Wechselrichter + '.Live.RuntimeTotal', 0, true);
	//adapter.setState(Wechselrichter + '.Live.Mode', 0, true);
	adapter.setState(Wechselrichter + '.Live.GridVoltageFault', 0, true);
	adapter.setState(Wechselrichter + '.Live.GridFreqFault', 0, true);
	adapter.setState(Wechselrichter + '.Live.DCinjectionFault', 0, true);
	adapter.setState(Wechselrichter + '.Live.TemperatureFault', 0, true);
	adapter.setState(Wechselrichter + '.Live.PV1VoltageFault', 0, true);
	adapter.setState(Wechselrichter + '.Live.PV2VoltageFault', 0, true);
	adapter.setState(Wechselrichter + '.Live.GFCfault', 0, true);
	adapter.setState(Wechselrichter + '.Live.ErrorMessage', 0, true);
	//adapter.setState(Wechselrichter + '.Live.ModeText', 0, true);
	adapter.setState(Wechselrichter + '.Live.ErrorMessageJson', '', true);
}


function update_Info_data(Info_Data_hex, Info_Data_ascii, Info_Objekt) {

	for (var count = 0; count < Info_Data_hex.length; count++) {
		adapter.setState(Wechselrichter + '.Info.' + Info_Objekt[count], Info_Data_ascii[count], true);
	}
}


function update_Live_data(Live_Data_hex, Live_Data_ascii, Live_Objekt) {

	for (var count = 0; count < Live_Data_hex.length; count++) {
		adapter.setState(Wechselrichter + '.Live.' + Live_Objekt[count], Live_Data_ascii[count], true);
	}

}



function create_wr(Info_Beschreibung, Info_Objekt, Live_Beschreibung, Live_Objekt) {
	
	    adapter.setObjectNotExists(Wechselrichter, {
        type: 'device',
        common: {
            name: Wechselrichter,
            role: 'inverter'
        },
    });
	
        adapter.setObjectNotExistsAsync(Wechselrichter + '.Online', {
            type: 'state',
            common: {
                name: 'Wechselrichter online',
                type: 'boolean',
                role: 'indicator',
                read: true,
                write: false,
            },
            native: {},
        });	
	
	    adapter.setObjectNotExists(Wechselrichter + '.Info', {
        type: 'channel',
        common: {
            name: 'Informationen',
            role: 'info'
        },
    });
	
		adapter.setObjectNotExists(Wechselrichter + '.Live', {
        type: 'channel',
        common: {
            name: 'Live-Daten',
            role: 'info'
        },
    });	



    adapter.setObjectNotExists(Wechselrichter + '.Info.' + Info_Objekt[0], { //Device Type
        type: 'state',
        common: {
            "name":     Info_Beschreibung[0],
            "type":     "number",
            "unit":     "",
            "read":     true,
            "write":    false,
            "role":     "value.type",
            "desc":     Info_Beschreibung[0]
        },
        native: {}
    });

    adapter.setObjectNotExists(Wechselrichter + '.Info.' + Info_Objekt[1], { //rated Power
        type: 'state',
        common: {
            "name":     Info_Beschreibung[1],
            "type":     "string",
            "unit":     "",
            "read":     true,
            "write":    false,
            "role":     "value.type",
            "desc":     Info_Beschreibung[1]
        },
        native: {}
    });
	
    adapter.setObjectNotExists(Wechselrichter + '.Info.' + Info_Objekt[2], { //Firmware Version
        type: 'state',
        common: {
            "name":     Info_Beschreibung[2],
            "type":     "string",
            "unit":     "",
            "read":     true,
            "write":    false,
            "role":     "value.type",
            "desc":     Info_Beschreibung[2]
        },
        native: {}
    });
	
    adapter.setObjectNotExists(Wechselrichter + '.Info.' + Info_Objekt[3], { //Modul Name
        type: 'state',
        common: {
            "name":     Info_Beschreibung[3],
            "type":     "string",
            "unit":     "",
            "read":     true,
            "write":    false,
            "role":     "value.type",
            "desc":     Info_Beschreibung[3]
        },
        native: {}
    });

    adapter.setObjectNotExists(Wechselrichter + '.Info.' + Info_Objekt[4], { //Hersteller
        type: 'state',
        common: {
            "name":     Info_Beschreibung[4],
            "type":     "string",
            "unit":     "",
            "read":     true,
            "write":    false,
            "role":     "value.type",
            "desc":     Info_Beschreibung[4]
        },
        native: {}
    });

    adapter.setObjectNotExists(Wechselrichter + '.Info.' + Info_Objekt[5], { //Seriennummer
        type: 'state',
        common: {
            "name":     Info_Beschreibung[5],
            "type":     "string",
            "unit":     "",
            "read":     true,
            "write":    false,
            "role":     "value.type",
            "desc":     Info_Beschreibung[5]
        },
        native: {}
    });

    adapter.setObjectNotExists(Wechselrichter + '.Info.' + Info_Objekt[6], { //Rated Bus Voltage
        type: 'state',
        common: {
            "name":     Info_Beschreibung[6],
            "type":     "string",
            "unit":     "",
            "read":     true,
            "write":    false,
            "role":     "value.type",
            "desc":     Info_Beschreibung[6]
        },
        native: {}
    });

// ***************** LIVE ********************
    adapter.setObjectNotExists(Wechselrichter + '.Live.' + Live_Objekt[0], {  // temperatur
        type: 'state',
        common: {
			"name":     Live_Beschreibung[0],
            "type":     "number",
            "unit":     "°C",
            "read":     true,
            "write":    false,
            "role":     "value.sensor",
            "desc":     Live_Beschreibung[0]
        },
        native: {}
    });

    adapter.setObjectNotExists(Wechselrichter + '.Live.' + Live_Objekt[1], { // energy today
        type: 'state',
        common: {
			"name":     Live_Beschreibung[1],
            "type":     "number",
            "unit":     "kWh",
            "read":     true,
            "write":    false,
            "role":     "value.sensor",
            "desc":     Live_Beschreibung[1]
        },
        native: {}
    });

    adapter.setObjectNotExists(Wechselrichter + '.Live.' + Live_Objekt[2], { // PV1 Voltage
        type: 'state',
        common: {
			"name":     Live_Beschreibung[2],
            "type":     "number",
            "unit":     "V",
            "read":     true,
            "write":    false,
            "role":     "value.sensor",
            "desc":     Live_Beschreibung[2]
        },
        native: {}
    });

    adapter.setObjectNotExists(Wechselrichter + '.Live.' + Live_Objekt[3], { // PV2 Voltage
        type: 'state',
        common: {
			"name":     Live_Beschreibung[3],
            "type":     "number",
            "unit":     "V",
            "read":     true,
            "write":    false,
            "role":     "value.sensor",
            "desc":     Live_Beschreibung[3]
        },
        native: {}
    });

    adapter.setObjectNotExists(Wechselrichter + '.Live.' + Live_Objekt[4], { // pv1 current
        type: 'state',
        common: {
			"name":     Live_Beschreibung[4],
            "type":     "number",
            "unit":     "A",
            "read":     true,
            "write":    false,
            "role":     "value.sensor",
            "desc":     Live_Beschreibung[4]
        },
        native: {}
    });

    adapter.setObjectNotExists(Wechselrichter + '.Live.' + Live_Objekt[5], { // pv2 current
        type: 'state',
        common: {
			"name":     Live_Beschreibung[5],
            "type":     "number",
            "unit":     "A",
            "read":     true,
            "write":    false,
            "role":     "value.sensor",
            "desc":     Live_Beschreibung[5]
        },
        native: {}
    });

    adapter.setObjectNotExists(Wechselrichter + '.Live.' + Live_Objekt[6], {// PV1 Power
        type: 'state',
        common: {
			"name":     Live_Beschreibung[6],
            "type":     "number",
            "unit":     "W",
            "read":     true,
            "write":    false,
            "role":     "value.sensor",
            "desc":     Live_Beschreibung[6]
        },
        native: {}
    });

    adapter.setObjectNotExists(Wechselrichter + '.Live.' + Live_Objekt[7], {// PV2 Power
        type: 'state',
        common: {
			"name":     Live_Beschreibung[7],
            "type":     "number",
            "unit":     "W",
            "read":     true,
            "write":    false,
            "role":     "value.sensor",
			"desc":     Live_Beschreibung[7]
        },
        native: {}
    });

    adapter.setObjectNotExists(Wechselrichter + '.Live.' + Live_Objekt[8], {// ac current
        type: 'state',
        common: {
			"name":     Live_Beschreibung[8],
            "type":     "number",
            "unit":     "A",
            "read":     true,
            "write":    false,
            "role":     "value.sensor",
			"desc":     Live_Beschreibung[8]
        },
        native: {}
    });

    adapter.setObjectNotExists(Wechselrichter + '.Live.' + Live_Objekt[9], {// ac voltage
        type: 'state',
        common: {
			"name":     Live_Beschreibung[9],
            "type":     "number",
            "unit":     "V",
            "read":     true,
            "write":    false,
            "role":     "value.sensor",
			"desc":     Live_Beschreibung[9]
        },
        native: {}
    });

    adapter.setObjectNotExists(Wechselrichter + '.Live.' + Live_Objekt[10], {// ac frequency
        type: 'state',
        common: {
			"name":     Live_Beschreibung[10],
            "type":     "number",
            "unit":     "Hz",
            "read":     true,
            "write":    false,
            "role":     "value.sensor",
			"desc":     Live_Beschreibung[10]
        },
        native: {}
    });

    adapter.setObjectNotExists(Wechselrichter + '.Live.' + Live_Objekt[11], {// ac power
        type: 'state',
        common: {
			"name":     Live_Beschreibung[11],
            "type":     "number",
            "unit":     "W",
            "read":     true,
            "write":    false,
            "role":     "value.sensor",
			"desc":     Live_Beschreibung[11]
        },
        native: {}
    });

    adapter.setObjectNotExists(Wechselrichter + '.Live.' + Live_Objekt[12], {// energy total
        type: 'state',
        common: {
			"name":     Live_Beschreibung[12],
            "type":     "number",
            "unit":     "kWh",
            "read":     true,
            "write":    false,
            "role":     "value.sensor",
			"desc":     Live_Beschreibung[12]
        },
        native: {}
    });

    adapter.setObjectNotExists(Wechselrichter + '.Live.' + Live_Objekt[13], {// runtime total
        type: 'state',
        common: {
			"name":     Live_Beschreibung[13],
            "type":     "number",
            "unit":     "h",
            "read":     true,
            "write":    false,
            "role":     "value.sensor",
			"desc":     Live_Beschreibung[13]
        },
        native: {}
    });
    adapter.setObjectNotExists(Wechselrichter + '.Live.' + Live_Objekt[14], {// mode
        type: 'state',
        common: {
			"name":     Live_Beschreibung[14],
            "type":     "number",
            "unit":     "",
            "read":     true,
            "write":    false,
            "role":     "value.sensor",
			"desc":     Live_Beschreibung[14]
        },
        native: {}
    });

    adapter.setObjectNotExists(Wechselrichter + '.Live.' + Live_Objekt[15], { // grid voltage fault
        type: 'state',
        common: {
			"name":     Live_Beschreibung[15],
            "type":     "number",
            "unit":     "V",
            "read":     true,
            "write":    false,
            "role":     "value.sensor",
			"desc":     Live_Beschreibung[15]
        },
        native: {}
    });

    adapter.setObjectNotExists(Wechselrichter + '.Live.' + Live_Objekt[16], { // grid freq  fault
        type: 'state',
        common: {
			"name":     Live_Beschreibung[16],
            "type":     "number",
            "unit":     "Hz",
            "read":     true,
            "write":    false,
            "role":     "value.sensor",
			"desc":     Live_Beschreibung[16]
        },
        native: {}
    });

    adapter.setObjectNotExists(Wechselrichter + '.Live.' + Live_Objekt[17], { // dc injection fault
        type: 'state',
        common: {
			"name":     Live_Beschreibung[17],
            "type":     "number",
            "unit":     "mA",
            "read":     true,
            "write":    false,
            "role":     "value.sensor",
			"desc":     Live_Beschreibung[17]
        },
        native: {}
    });

    adapter.setObjectNotExists(Wechselrichter + '.Live.' + Live_Objekt[18], { // temperature fault
        type: 'state',
        common: {
			"name":     Live_Beschreibung[18],
            "type":     "number",
            "unit":     "°C",
            "read":     true,
            "write":    false,
            "role":     "value.sensor",
			"desc":     Live_Beschreibung[18]
        },
        native: {}
    });

    adapter.setObjectNotExists(Wechselrichter + '.Live.' + Live_Objekt[19], { // pv1 voltage fault
        type: 'state',
        common: {
			"name":     Live_Beschreibung[19],
            "type":     "number",
            "unit":     "V",
            "read":     true,
            "write":    false,
            "role":     "value.sensor",
			"desc":     Live_Beschreibung[19]
        },
        native: {}
    });


    adapter.setObjectNotExists(Wechselrichter + '.Live.' + Live_Objekt[20], { // pv2 voltage fault
        type: 'state',
        common: {
			"name":     Live_Beschreibung[20],
            "type":     "number",
            "unit":     "V",
            "read":     true,
            "write":    false,
            "role":     "value.sensor",
			"desc":     Live_Beschreibung[20]
        },
        native: {}
    });

    adapter.setObjectNotExists(Wechselrichter + '.Live.' + Live_Objekt[21], { // gfc fault
        type: 'state',
        common: {
			"name":     Live_Beschreibung[21],
            "type":     "number",
            "unit":     "mA",
            "read":     true,
            "write":    false,
            "role":     "value.sensor",
			"desc":     Live_Beschreibung[21]
        },
        native: {}
    });

    adapter.setObjectNotExists(Wechselrichter + '.Live.' + Live_Objekt[22], { // error message
        type: 'state',
        common: {
			"name":     Live_Beschreibung[22],
            "type":     "string",
            "unit":     "",
            "read":     true,
            "write":    false,
            "role":     "value.sensor",
			"desc":     Live_Beschreibung[22]
        },
        native: {}
    });

    adapter.setObjectNotExists(Wechselrichter + '.Live.' + Live_Objekt[23], { // Mode text
        type: 'state',
        common: {
			"name":     Live_Beschreibung[23],
            "type":     "string",
            "unit":     "",
            "read":     true,
            "write":    false,
            "role":     "value.sensor",
			"desc":     Live_Beschreibung[23]
        },
        native: {}
    });

    adapter.setObjectNotExists(Wechselrichter + '.Live.' + Live_Objekt[24], { // error message text
        type: 'state',
        common: {
			"name":     Live_Beschreibung[24],
            "type":     "string",
            "unit":     "",
            "read":     true,
            "write":    false,
            "role":     "value.sensor",
			"desc":     Live_Beschreibung[24]
        },
        native: {}
    });



	
}





function hex2a(hexx) {
    var hex = hexx.toString();//force conversion
    var str = '';
    for (var i = 0; i < hex.length; i += 2)
        str += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
    return str;
}


function decimalToHex(d, padding) {
    var hex = Number(d).toString(16);
    padding = typeof (padding) === "undefined" || padding === null ? padding = 2 : padding;

    while (hex.length < padding) {
        hex = "0" + hex;
    }

    return hex;
}



function antwort_formatiert(befehl) {
	var x = '';
	
	for ( let i=0; i<=befehl.length-1; i += 2 ) {
		x = x + befehl.slice(i, i+2) + " "
	}
	return x.slice(0, parseFloat(x.length) - 1);	
}

// If started as allInOne/compact mode => return function to create instance
if (module && module.parent) {
    module.exports = startAdapter;
} else {
    // or start the instance directly
    startAdapter();
} 
