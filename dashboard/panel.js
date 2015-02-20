'use strict';

var $panel = $bundle.filter('.subscriptions');
var $reconnect = $panel.find('.ctrl-reconnect');
var $logs = $panel.find('.log');
var $clearLogs = $panel.find('.ctrl-clearLogs');

var MAX_LOG_LEN = 30;

nodecg.listenFor('subscription', addSub);

nodecg.declareSyncedVar({
    name: 'reconnecting',
    setter: function(newVal) {
        $reconnect.prop('disabled', newVal);
    }
});

nodecg.listenFor('log', function(msg) {
    $logs.append('<div class="log-message">' + msg + '</div>');

    var $children = $logs.children();
    var len = $children.length;
    if (len > MAX_LOG_LEN) {
        var $toDelete = $children.slice(0, len - MAX_LOG_LEN);
        $toDelete.remove();
    }

    $logs.animate({ scrollTop: $logs[0].scrollHeight}, 1000);
});

var button =
    '<button type="button" data-dismiss="alert" class="close">' +
        '<span aria-hidden="true">×</span>' +
        '<span class="sr-only">Close</span>' +
    '</button>';

function addSub(data) {
    var alert =
        '<div role="alert" class="alert alert-dismissible ' + (data.resub ? 'bg-primary' : 'alert-info') + ' sub">' +
            button +
            '<div style="white-space: pre;">' +
                '<strong>' + data.name +'</strong>' + (data.resub ? ' - Resub' : '') +
            '</div>' +
        '</div>';

    $('#lfg-sublistener_list').prepend(alert);
}

$('#lfg-sublistener_clearall').click(function() {
    $('#lfg-sublistener_list .sub').remove();
});

$reconnect.click(function() {
    console.log('clicked, disabling');
    $reconnect.prop('disabled', true);
    nodecg.sendMessage('reconnect');
});

$clearLogs.click(function() {
   $logs.children().remove();
});