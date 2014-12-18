'use strict';

nodecg.listenFor('subscription', addSub);

var button = '<button type="button" data-dismiss="alert" class="close"><span aria-hidden="true">×</span><span class="sr-only">Close</span></button>'
function addSub(data) {
    var alert = '<div role="alert" class="alert alert-dismissible ' + (data.resub ? 'bg-primary' : 'alert-info') + ' sub">' + button +
        '<div style="white-space: pre;"></div><strong>' + data.name +'</strong>' + (data.resub ? ' - Resub' : '') + '</div></div>';

    $('#lfg-sublistener_list').prepend(alert);
}

$('#lfg-sublistener_clearall').click(function() {
    $('#lfg-sublistener_list .sub').remove();
});