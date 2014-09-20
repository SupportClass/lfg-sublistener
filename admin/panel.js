$(function () {
    $('#sublist_clearall').click(function() { });

    nodecg.listenFor('subscriber', addSub);

    var button = '<button type="button" data-dismiss="alert" class="close"><span aria-hidden="true">×</span><span class="sr-only">Close</span></button>'
    function addSub(data) {
        var alert = '<div role="alert" class="alert alert-dismissible ' + (data.resub ? 'bg-primary' : 'alert-info') + ' sub">' + button +
            '<div style="white-space: pre;"></div><strong>' + data.name +'</strong>' + (data.resub ? ' - Resub' : ' - New') + '</div></div>';

        $('#sublist_list').prepend(alert);
    }

    $('#sublist_clearall').click(function() {
       $('#sublist .sub').remove();
    });
});
