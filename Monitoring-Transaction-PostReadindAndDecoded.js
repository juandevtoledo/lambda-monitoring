const aws =  require("aws-sdk");
var sqs = new aws.SQS({region : 'us-east-1'});
function validateTransactionRejected(kinesisPayload){
	return kinesisPayload.transactionChannel === "INTERBANKING" && 
		kinesisPayload.transactionType === "CASHOUT" && 
		kinesisPayload.transactionStatus === "REJECTED";
}
function getInterbankTransactionEventPayload(kinesisPayload){
	return {
		transactionId: kinesisPayload.transactionId,
		userFrom: kinesisPayload.userFrom,
		userTo: kinesisPayload.userTo,
		createdAt: kinesisPayload.createdAt,
		updatedAt: kinesisPayload.updatedAt,
		status: kinesisPayload.transactionStatus
	};
}
function isAccountClosureTransaction(kinesisPayload){
	return kinesisPayload.transactionType === "CLOSE_ACCOUNT";
}
function isClosureBlockedByOnHoldMovements(kinesisPayload){
	return kinesisPayload.transactionType === "CLOSE_ACCOUNT_BLOCK";
}
function getClosureBlockedByOnHoldMovementsPayload(kinesisPayload) {
	return {
		idCBS: kinesisPayload.userFrom ? kinesisPayload.userFrom.clientId : "",
		idSavingAccount: kinesisPayload.methodFrom ? kinesisPayload.methodFrom.id : "",
		idClosureTransaction: kinesisPayload.transactionTraceNumber
	};
}
function isLoanAutomaticPayments(kinesisPayload){
	return kinesisPayload.transactionType === "LOAN_AUTOMATIC_PAYMENT";
}
function getLoanAutomaticPaymentsPayload(kinesisPayload) {
	return {
		cbsId: kinesisPayload.userFrom.clientId,
		paymentStatus: kinesisPayload.transactionStatus,
		valuePaid: kinesisPayload.transactionAmountData.total
	};
}

function isCardTransactionEvent(kinesisPayload){
	return kinesisPayload.transactionType === "AUTHORIZATION" || 
	kinesisPayload.transactionType === "WITHDRAWAL_SINGLE_CARD";
}

function isSavingsTransactionEvent(kinesisPayload){
	return kinesisPayload.transactionType === "WITHDRAWAL_SINGLE_CARDLESS";
}

function isInternalTransferEvent(kinesisPayload){
	return kinesisPayload.transactionType === "INTERNAL_TRANSFER"
}

function isInterbankingCreditReceiveEvent(kinesisPayload){
	return kinesisPayload.transactionType === "INTERBANKING_CREDIT_RECEIVE"
}

function isInterbankingCreditSendEvent(kinesisPayload){
	return kinesisPayload.transactionType === "INTERBANKING_CREDIT_SEND"
}

function isPseRecharge(kinesisPayload){
	return kinesisPayload.transactionType === "CASHIN_PSE"
}

const isReferralTransferExpired = (kinesisPayload) => kinesisPayload.transactionType === "INTERNAL_TRANSFER" &&
													kinesisPayload.originalType === "INTERNAL_TRANSFER_REFERRAL" &&
													kinesisPayload.transactionStatus === "EXPIRED";

exports.handler = function(event, context, callback) {
	console.log(event);// To verify Kinesis event
	let payloadKinesis = "";
	event.Records.forEach(function(record) {
	  // Kinesis data is base64 encoded so decode here
	  console.log('Payload kinesis data ',record.kinesis.data);
	  payloadKinesis = new Buffer(record.kinesis.data, 'base64').toString();
	  console.log('Payload kinesis',payloadKinesis);
	  let payloadJSON = JSON.parse(payloadKinesis);
	  var newMonitoringEventVar={
		  id:context.awsRequestId, 
		  eventType:"NewMonitoringEvent",
		  payload: payloadJSON
	  }
	  var newNotificationEventVar={
		  id:context.awsRequestId, 
		  eventType:"NewNotificationEvent",
		  payload: payloadJSON
	  }
	  if(validateTransactionRejected(payloadJSON)){
		  console.log("Transaction was rejected.");
		  let interBankTransactionResultEventVar = {
			  id: context.awsRequestId, 
			  eventType: "InterBankTransactionResult",
			  payload: getInterbankTransactionEventPayload(payloadJSON)
		  }
		  var paramsTransactions = {
			MessageBody: JSON.stringify(interBankTransactionResultEventVar),
			QueueUrl: process.env.QUEUE_URL_TRANSACTIONS
		  };
		  console.log('InterBankTransactionResult - ' + JSON.stringify(paramsTransactions));
	  }
	  if (isAccountClosureTransaction(payloadJSON)) {
		  console.log("Account closure transaction.");
		  const closeAccountResponseEventVar = {
			  id: context.awsRequestId,
			  eventType: "CloseAccountResponse",
			  payload: payloadJSON
		  }
		  var paramsSavings = {
			  MessageBody: JSON.stringify(closeAccountResponseEventVar),
			  QueueUrl: process.env.QUEUE_URL_SAVINGS
		  };
		  console.log('CloseAccountResponse: ' + JSON.stringify(paramsSavings));
	  }
	  if (isClosureBlockedByOnHoldMovements(payloadJSON)) {
		console.log("Account closure blocked by on hold movements.");
		let closureBlockedByOnHoldMovementsEventVar = {
			id: context.awsRequestId,
			eventType: "ClosureBlockedByOnHoldMovements",
			payload: getClosureBlockedByOnHoldMovementsPayload(payloadJSON)
		}
		var paramsSavings = {
			MessageBody: JSON.stringify(closureBlockedByOnHoldMovementsEventVar),
			QueueUrl: process.env.QUEUE_URL_SAVINGS
		};
		console.log('ClosureBlockedByOnHoldMovements: ' + JSON.stringify(paramsSavings));
	  }
	  if (isLoanAutomaticPayments(payloadJSON)) {
		console.log("Loan Automatic Payments recieve.");
		let loanAutomaticPaymentsEvent = {
			id: context.awsRequestId,
			eventType: "LoanAutomaticPayment",
			payload: getLoanAutomaticPaymentsPayload(payloadJSON)
		}
		var paramsNotificationV2 = {
			MessageBody: JSON.stringify(loanAutomaticPaymentsEvent),
			QueueUrl: process.env.QUEUE_URL_CLIENTS_V2
		};
		console.log('LoanAutomaticPayments: ' + JSON.stringify(paramsNotificationV2));
	  }
	  if (isCardTransactionEvent(payloadJSON)) {
		console.log("Card Transaction Event received.");
		let cardTransactionEvent = {
			id: context.awsRequestId,
			eventType: "CardTransactionEvent",
			payload: payloadJSON
		}
		var paramsCards = {
			MessageBody: JSON.stringify(cardTransactionEvent),
			QueueUrl: process.env.QUEUE_URL_CARDS
		};
		console.log('CardTransactionEvent: ' + JSON.stringify(paramsCards));
	  }
	  
	  if (isSavingsTransactionEvent(payloadJSON)) {
		console.log("Savings Transaction Event received.");
		let savingsTransactionEvent = {
			id: context.awsRequestId,
			eventType: "SavingsTransactionEvent",
			payload: payloadJSON
		}
		var paramsSavings = {
			MessageBody: JSON.stringify(savingsTransactionEvent),
			QueueUrl: process.env.QUEUE_URL_SAVINGS
		};
		console.log('SavingsTransactionEvent: ' + JSON.stringify(paramsSavings));
	  }

	  if (isReferralTransferExpired(payloadJSON)) {
	  	console.log("Event: Referral transfer hold EXPIRED")
	  	var referralUpdate = "ReferralHoldExpiredMessage"
		let transactionsMessage = {
			id: context.awsRequestId,
			eventType: referralUpdate,
			payload: payloadJSON
		}
		var paramsTransactions = {
			MessageBody: JSON.stringify(transactionsMessage),
			QueueUrl: process.env.QUEUE_URL_TRANSACTIONS_V2
		};
		console.log('ReferralHoldExpiredMessage - ', JSON.stringify(paramsTransactions), "\n");
	  } else if(isInternalTransferEvent(payloadJSON)){
	  	console.log("Internal Transfer Event received.");
		var typeTransaction= "InternalTransferNotificationMessage"
	  }

	  if(isInterbankingCreditReceiveEvent(payloadJSON)){
	  	console.log("Interbanking Credit Receive Event received.")
		var typeTransaction= "InterbankingCreditReceiveNotificationMessage"
	  }

	  if(isInterbankingCreditSendEvent(payloadJSON)){
	  	console.log("Interbanking Credit Send Event received.")
		var typeTransaction= "InterbankingCreditSendNotificationMessage"
	  }

	  if(isPseRecharge(payloadJSON)){
		console.log("Pse recharge event received")
	  var typeTransaction= "PseRechargeMessage"
	}
	  
	  if(!paramsCards && !paramsSavings && !typeTransaction && !referralUpdate){
		  var paramsNotification = {
			MessageBody: JSON.stringify(newNotificationEventVar),
			QueueUrl: process.env.QUEUE_URL_NOTIFICATIONS
		  };

		  console.log('NewNotificationEvent - ' + JSON.stringify(paramsNotification) +"\n");
		  sqs.sendMessage(paramsNotification, function(err,data){
			  if(err) {
				  console.log('error:',"Notification-Transaction -  Fail Send Message to SQS verify lambda Notification-Transaction " + err);
				  callback(null, event);
			  }
			  else{
				  //console.log('data:',updateEmailInfo.id);
				  callback(null, event);
			  }});	  
	  }
	  var paramsMonitoring = {
		MessageBody: JSON.stringify(newMonitoringEventVar),
		QueueUrl: process.env.QUEUE_URL_MONITORING
	  };
 
	  console.log('NewMonitoringEvent - ' + JSON.stringify(paramsMonitoring) +"\n");
	  sqs.sendMessage(paramsMonitoring, function(err,data){
		  if(err) {
			  console.log('error:',"Monitoring-Transaction -  Fail Send Message to SQS verify lambda Monitoring-Transaction " + err);
			  callback(null, event);
		  }
		  else{
			  //console.log('data:',updateEmailInfo.id);
			  callback(null, event);
		  }});

	  if(paramsTransactions){
		  sqs.sendMessage(paramsTransactions, function(err,data){
			  if(err) {
				  console.log('error:',"Transactions -  Fail Send Message to SQS verify lambda Transactions: " + err);
			  }
			  callback(null, event);
		  });
	  }
	  if(paramsSavings){
		  sqs.sendMessage(paramsSavings, function (err) {
			  if (err) {
				  console.log('error:', "SavingsAccounts - Failed to send message to SQS Savings: " + err);
			  }
			  callback(null, event);
		  });
	  }
	  if(paramsNotificationV2){
		  sqs.sendMessage(paramsNotificationV2, function (err) {
			  if (err) {
				  console.log('error:', "Notification - Failed to send message to Notification V2  " + err);
			  }
			  callback(null, event);
		  });
		paramsNotificationV2 = null ;	
	  }
	  if(paramsCards){
		  sqs.sendMessage(paramsCards, function (err) {
			  if (err) {
				  console.log('error:', "Cards - Failed to send message to Cards  " + err);
			  }
			  callback(null, event);
		  });
		paramsCards = null ;	
	  }

	  if(typeTransaction){
		  let transferSendEvent = {
			  id: context.awsRequestId,
			  eventType: typeTransaction,
			  payload: payloadJSON
		  }
		  var paramsTransfer = {
			  MessageBody: JSON.stringify(transferSendEvent),
			  QueueUrl: process.env.QUEUE_URL_CLIENT_ALERTS_V2
		  }
		  console.log(typeTransaction + ' : ' + JSON.stringify(paramsTransfer));
		  sqs.sendMessage(paramsTransfer, function (err){
	  		if(err){
	  			console.log('error:', "Transfer - Failed to send message to Client Alerts V2  " + err)
			}
	  		callback(null, event);
		});
	  }
    });
};