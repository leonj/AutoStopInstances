'use strict';

/**
 * AWS Lambda function that when executed stops servers with the tag 'Schedule' and value contains the name of the Lambda function.
 * Please make sure that the Lambda function starts with 'stop-'
 */

// module dependencies
var AWS = require('aws-sdk');
	// Update default region for command invocation
	AWS.config.update({region: 'us-west-2'});
var pify = require('pify');
var Promise = require('pinkie-promise');

var ec2 = new AWS.EC2();

//Global variables...
var weekDays = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
var validTags = ['name', 'service', 'owner-description', 'costcentre', 'schedule', 'environment', 'tier', 'application', 'os'];

//Timezone hours UTC => Local 
var hoursToAdd = 11; //Change the value of hours in this parameter to execute in different time zone...
//======================================

/**
 * The handler function.
 */
exports.handler = function (event, context) {

	// Describe the instances
	pify(ec2.describeInstances.bind(ec2), Promise)()
		.then(function (data) {
			var stopParams = {
				InstanceIds: []
			};
        
            var todaysDate = new Date();        
            todaysDate.setHours(todaysDate.getHours() + hoursToAdd); //Converting to local sydney/melbourne time from UTC...
            //==========================================================================================================
            var startAppTime = todaysDate.getHours() + ":" + (todaysDate.getMinutes() < 10 ? '0':'') + todaysDate.getMinutes();
            var currentDay = todaysDate.getDay();
			var tagname;
			
            console.log("appStartTime is "+ startAppTime);			
			data.Reservations.forEach(function (reservation) {
				reservation.Instances.forEach(function (instance) {
					
					// 0: pending, 16: running, 32: shutting-down, 48: terminated, 64: stopping, 80: stopped
					if (instance.State.Code === 16) {
						
						var tagCount = 0; 
						
						instance.Tags.forEach(function (Tag) {	
							// Check if the instance has the tag 'schedule'
							tagname = Tag.Key.toLowerCase();
							
							// go through the arrary above and see if all valid tags are present
							for (var i = 0; i < validTags.length; i++) {
								if (validTags[i].toLowerCase().indexOf(tagname) != -1){
										tagCount++;
									}
								}		
							
							//if (tagname == 'schedule') {
								
								Tag.Value = "scheduleTesting";
								console.log("tagname is schedule ");
								console.log("Instance value is "+Tag.Value)
								
                                // Check if the tag values provided to start the server instance
								
								//console.log("Tag.Key has Schedule defined for instance "+ instance.InstanceId);
                                //if (checkStartTime(Tag.Value, instance.InstanceId, startAppTime, currentDay)) {
                              //      stopParams.InstanceIds.push(instance.InstanceId);
                              //  }
							//}
						});
						
					if (tagCount < validTags.length ){
						console.log("Noncomplianced Instance "+ instance.InstanceId);
						console.log("Stopping "+instance.InstanceId);
						//console.log("Instance Name is "+Tag.Value);
						stopParams.InstanceIds.push(instance.InstanceId);
						}
						
					else if (tagCount >= validTags.length ){
						console.log("Complianced Instance "+ instance.InstanceId);
						}												
					}
				});
			});

			if (stopParams.InstanceIds.length > 0) {
				// Stop the instances
				return pify(ec2.stopInstances.bind(ec2), Promise)(stopParams);
			}
		})
		.then(context.succeed)
		.catch(context.fail);
};


function checkStartTime(data, instanceId, startAppTime, currentDay) {
    var runNow = false;
    console.log(data);
    try {
        if (data.toLowerCase().indexOf("stop") != -1) {
            var attr = data.split(";");
            for (var i = 0; i < attr.length; i++) {
                if (attr[i].toLowerCase().indexOf("stop") != -1) {
                    //check the time to run and the days to run...
                    var timeToCheck = attr[i].split("|");
                    if (checkDaysToRun(timeToCheck[1], currentDay)) {
                        console.log(timeToCheck[0].split("=")[1]);
                        if (timeToCheck[0].split("=")[1] === startAppTime) {
                            runNow = true;
                            console.log('Stop the server:' + runNow);
                        }
                    }
                }
                if (attr[i].toLowerCase().indexOf("override") != -1) {
                    //Check if the override flag is true or not...
                    if (attr[i].split("=")[1].trim().toLowerCase() === "on") {
                        console.log("Override specified for instance Id:" + instanceId);
                        return false;
                    }
                }
            };
        }
        else {
            throw new Error("Stop time not provided for instance:" + instanceId);
        }
        return runNow;
    } catch (ex) {
        throw ex;
    };
}

function checkDaysToRun(range, currentDay) {
    var run = false;
    console.log(currentDay +  ' ' + range);
    if (range.indexOf("-") != -1) {
        var dayRange = range.split("-");
        
        if (dayRange.length > 1) {
            var startDay = weekDays.indexOf(dayRange[0]);
            var endDay = weekDays.indexOf(dayRange[1]);
            
            if (startDay > endDay) {
                if (currentDay >= startDay && currentDay >= endDay) {
                    run = true;
                }
            }
            else {
                if (currentDay >= startDay && currentDay <= endDay) {
                    run = true;
                }
            }
        }
    }
    else if (range.toLowerCase() === weekDays[currentDay]) {
        run = true;
    }
    console.log('Day check run:' + run);
    return run;
}