'use strict';

function on_rule_change(event, synthetic) {
  if (synthetic) return;
  var val = $("input[type='radio'][name='form-groups-by']:checked").val();
  $.ajax('action.php',
         {type: 'POST',
          data: {action: 'partition.apply-rule',
                 rule: val},
          success: function(data) {
            console.log(data);
            poll_for_structure();
          }
         });
}
$(function() {
  $("input[type='radio'][name='form-groups-by']").on('change', on_rule_change);
});

function on_partition_label_change() {
  var rule = $("input[type='radio'][name='form-groups-by']:checked").val();
  var part_label = $("#partition-label").val();
  var part_label_lc = part_label.toLowerCase();
  $(".group-label").text(part_label);
  $("#add-partition-button").val("Add " + part_label);
  $(".partition-label-lc").text(part_label_lc);
  $(".group-label-lc").text(part_label_lc + " (group)");
  $(".subgroup-label-lc").text( part_label_lc + " (subgroup)");
  $.ajax('action.php',
         {type: 'POST',
          data: {action: 'settings.write',
                 'partition-label': $("#partition-label").val(),
                 'supergroup-label': $("#supergroup-label").val()
                }
         });
}
$(function() {
  $("#partition-label, #supergroup-label").on('keyup mouseup', on_partition_label_change);
});

function on_use_subgroups_change(event, synthetic) {
  if (synthetic) return;

  $.ajax('action.php',
         {type: 'POST',
          data: {action: 'settings.write',
                 'do-use-subgroups': $("#use-subgroups").is(':checked') ? 1 : 0,
                 'do-use-subgroups-checkbox': true},
          success: function(data) {
            if (data.outcome.summary != 'success') {
              console.log(data);
            }
            poll_for_structure();
          }
         });
}
$(function() { $("#use-subgroups").on('change', on_use_subgroups_change); });

function poll_for_structure() {
  $.ajax('action.php',
         {type: 'GET',
          data: {query: 'poll',
                 values: 'classes,partitions,race-structure'},
          success: function(data) {
            process_polling_data(data);
          }
         });
}

$(function() { poll_for_structure(); });  // Draw initial structure


function process_polling_data(data) {
  $("#use-subgroups")
    .prop('checked', data['use-subgroups'])
    .trigger('change', /*synthetic*/true);

  if (data['group-formation-rule'] != $("input[type='radio'][name='form-groups-by']:checked").val()) {
    $("input[type='radio'][name='form-groups-by']").attr('checked', false);
    $("input[type='radio'][name='form-groups-by'][value='" + data['group-formation-rule'] + "'")
      .attr('checked', true)
      .trigger('change', /*synthetic*/true);
  }

  // Instructions
  $("#drag-groups").toggleClass('hidden', data['group-formation-rule'] == 'one-group');
  $("#drag-subgroups").toggleClass('hidden', data['group-formation-rule'] == 'by-partition');
  $("#or-to-move").toggleClass('hidden', data['group-formation-rule'] != 'custom');

  populate_racing_groups(data);
  populate_aggregate_modal(data);
  populate_aggregates(data.classes);
  populate_labels(data.labels);
}

function populate_racing_groups(data) {
  var all_groups = $("ul#all-groups");
  all_groups.children('li').not('#new-group').remove();
  var rule = $("input[type='radio'][name='form-groups-by']:checked").val();
  var partition_label_lc = data.labels.partition[0].toLowerCase();

  var pigeonholed = false;  // Becomes true if any group has more than one subgroup
  for (var i = 0; i < data.classes.length; ++i) {
    if (data.classes[i].hasOwnProperty('constituents') &&
        data.classes[i].constituents.length > 0) {
      // Ignore aggregate groups here
      continue;
    }

    var cl = $("<li/>")
        .appendTo(all_groups)
        .addClass('group')
        .attr('data-classid', data.classes[i].classid)
        .attr('data-count', data.classes[i].count)
        .attr('data-nrounds', data.classes[i].nrounds)
        .attr('data-ntrophies', data.classes[i].ntrophies)
        // data-constituent-of
        .append($("<p/>")
                .addClass('class-name')
                .text(data.classes[i].name)
                // label and count are float-right, so the first span is rightmost
                .append($("<span/>").addClass('label')
                        .toggleClass('group-label-lc', rule == 'by-partition')
                        .text(rule == 'by-partition'
                              ? partition_label_lc + " (group)"
                              : "group"))
                .append($("<span/>").addClass('count')
                        .text("(" + data.classes[i].count + ")"))
                .prepend($("<input type='button' value='Edit' class='edit-button'/>")
                         .on('click', on_edit_class)));

    if (rule != 'by-partition') {
      var subgroups = $("<ul/>")
          .appendTo(cl)
          .addClass('subgroups');
      pigeonholed = pigeonholed || data.classes[i].subgroups.length > 1;
      for (var j = 0; j < data.classes[i].subgroups.length; ++j) {
        var rankid = data.classes[i].subgroups[j].rankid;
        var subg_p = $("<p/>")
                    .addClass('rank-name')
                    .text(data.classes[i].subgroups[j].name)
            .append($("<span/>").addClass('label subgroup-label-lc')
                    .text(partition_label_lc + " (subgroup)"))
            .append($("<span/>").addClass('count')
                    .text("(" + data.classes[i].subgroups[j].count + ")"));
        subg_p.prepend($("<input type='button' value='Edit' class='edit-button'/>")
                       .on('click', on_edit_rank));
        $("<li/>")
            .appendTo(subgroups)
            .addClass('subgroup')
            .attr('data-rankid', data.classes[i].subgroups[j].rankid)
            .attr('data-count', data.classes[i].subgroups[j].count)
            .append(subg_p);
      }
    }
  }
  $("#new-group").appendTo(all_groups).toggleClass('hidden',
                                                   rule != 'custom' || !pigeonholed);
  
  make_groups_sortable();
}

function make_groups_sortable() {
  $("ul#all-groups").sortable({
    items: "> li:not(#new-group)",
    stop: function(event, ui) {
      event.stopPropagation();

      var data = {action: 'class.order'};
      $("ul#all-groups > li").each(function(i) {
        data['classid_' + (i + 1)] = $(this).attr('data-classid');
      });
      $("ul#aggregate-groups > li").each(function(i) {
        data['classid_' + (i + 1)] = $(this).attr('data-classid');
      });
      console.log(data);
      $.ajax(g_action_url,
             {type: 'POST',
              data: data,
              success: function(data) {
                if (data.outcome.summary == 'success') {
                  poll_for_structure();
                }
              }
             });
    }
  });

  $("ul.subgroups").sortable({
    connectWith: "ul.subgroups",
    // Drag from one group to another produces: update, remove, receive, update, stop.
    helper: "clone",
    items: "> li.subgroup",
    receive: function(event, ui) {
      // event.target is the ul receiving the element
      console.log('receive', event, ui, 'item:', $(ui.item).text(), $(ui.item),
                  'target:', $(event.target).prop('nodeName'),
                  $(event.target).find('p').text(),
                  $(event.target),
                  $(event.target).find('li.subgroup'));
      // $(ui.item).appendTo($(event.target));
      var rankid = $(ui.item).attr('data-rankid');
      var classid = $(event.target).closest('li.group').attr('data-classid');
        $.ajax(g_action_url,
               {type: 'POST',
                data: {action: 'rank.move',
                       rankid: rankid,
                       classid: classid},
                success: function(data) {
                  // The #new-group li doesn't get deleted/recreated, so has to be
                  // managed explicitly if a new subgroup was dropped on it.
                  $("li#new-group ul.subgroups").empty();
                  if (false && data.outcome.summary == 'success') {
                    poll_for_structure();
                  }
                }
               });
    },
    stop: function(event, ui) {
      // ui.item is the li.subgroup being moved.
      event.stopPropagation();
      // ranks.order doesn't care about the classid; it just updates sortorder for the ranks in question.
      var data = {action: 'rank.order'};
      $(ui.item).closest('ul.subgroups').find("li.subgroup").each(function(i) {
        data['rankid_' + (i + 1)] = $(this).attr('data-rankid');
      });
      $.ajax(g_action_url,
             {type: 'POST',
              data: data,
              success: function(data) {
                if (data.outcome.summary == 'success') {
                  poll_for_structure();
                }
              }
             });
    }
  });
}

function populate_aggregates(classes) {
  var agg_groups = $("ul#aggregate-groups");
  agg_groups.empty();

  for (var i = 0; i < classes.length; ++i) {
    if (!(classes[i].hasOwnProperty('constituents') && classes[i].constituents.length > 0)) {
      continue;  // Aggregates only
    }
    var cl = $("<li/>")
        .appendTo(agg_groups)
        .addClass('aggregate')
        .attr('data-classid', classes[i].classid)
        .attr('data-count', classes[i].count)
        .attr('data-nrounds', classes[i].nrounds)
        .attr('data-ntrophies', classes[i].ntrophies)
    // data-constituent-of
        .append($("<p/>")
                .attr('data-classid', classes[i].classid)
                .addClass('class-name')
                .text(classes[i].name)
                .append($("<span/>").text("agg group").addClass('label'))
                .prepend($("<input type='button' value='Edit' class='edit-button'/>")
                         .on('click', on_edit_class)));

    var constituents = $("<ul/>")
        .appendTo(cl)
        .addClass('constituents');
    // TODO poll.classes should report classid and classname in
    //  constituent-rank, obtainable from parallel constituents field?
    if (classes[i].hasOwnProperty('constituent-ranks')) {
      for (var v = 0; v < classes[i]['constituent-ranks'].length; ++v) {
        $("<li/>")
          .appendTo(constituents)
          .addClass('constituent-rank')
          .append($("<p/>").text(classes[i]['constituent-ranks'][v].name)
                  .append($("<span/>").text("constituent").addClass('label')));
      }
    } else {
      for (var v = 0; v < classes[i].constituents.length; ++v) {
        $("<li/>")
          .appendTo(constituents)
          .addClass('constituent')
          .append($("<p/>").text(classes[i].constituents[v].name)
                  .append($("<span/>").text("constituent").addClass('label')));
      }
    }

    for (var v = 0; v < classes[i].constituents.length; ++v) {
      // If a given class is a constituent of multiple aggregates, the last one wins
      $("li[data-classid='" + classes[i].constituents[v] + "']")
        .attr('data-constituent-of', classes[i].name);
    }
  }
}

function populate_labels(labels) {
  $("span.partition-label").text(labels.partition[0]);
  $("span.partition-label-lc").text(labels.partition[0].toLowerCase());
  $("span.partition-label-pl-lc").text(labels.partition[1].toLowerCase());
  $("span.group-label").text(labels.group[0]);
  $("span.subgroup-label").text(labels.subgroup[0]);
  $("#aggregate-by-div .flipswitch .off").text(labels.group[0]);
  $("#aggregate-by-div .flipswitch .on").text(labels.subgroup[0]);
  $("#add_partition_button").prop('value', "Add " + labels.partition[0]);
  $("#delete_class_button")
    .prop('value', "Delete " + labels.group[0])
    .prop('data-label', labels.group[0]);
  $("#delete_rank_button")
    .prop('value', "Delete " + labels.subgroup[0])
    .prop('data-label', labels.subgroup[0]);
  $("#delete_partition_button")
    .prop('value', "Delete " + labels.partition[0])
    .prop('data-label', labels.partition[0]);
}
