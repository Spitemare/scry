(function($, _, undefined) {

    const TEMPLATES = $('<div></div>').load(_.extension.getURL('template.html')),
          IMAGE_URL = 'http://gatherer.wizards.com/Handlers/Image.ashx?type=card&multiverseid=';

    function prices(card) {
        return $.Deferred(function(dfd) {
            _.runtime.sendMessage({
                type : 'prices',
                card : card
            }, function(prices) {
                if (prices) dfd.resolve(prices);
                else dfd.reject();
            });
        }).promise();
    }

    function oracle(query) {
        return $.Deferred(function(dfd) {
            query.type = 'oracle';
            _.runtime.sendMessage(query, function(card) {
                console.log(card);
                if (card) dfd.resolve(card);
                else dfd.reject();
            });
        }).promise();
    }

    function show(e) {
        var scry = $(this).data('scry'),
            w = scry.width(), h = scry.height(),
            b = $(window).width(), s = $(window).scrollTop(),
            x = e.pageX, y = e.pageY,
            cl, ct;
        $('.scry').fadeOut(300);
        if (b - 15 >= w + x) cl = x + 5;
        else cl = b - w - 15;
        if (s + 20 >= y - h) ct = y + 10;
        else ct = y - h - 10;
        scry.css({ left : cl, top : ct }).fadeIn(300);
    }

    function hide() {
        var timeout = window.setTimeout($.proxy(function() {
            $(this).data('scry').fadeOut(300).queue(function() {
                $(this).find('.scry-info').hide();
                $(this).dequeue();
            });
        }, this), 500);
        $(this).data('scry-timeout', timeout);
    }

    function clearTimeout() {
        window.clearTimeout($(this).data('scry-timeout'));
    }

    function flip(card) {
        var flipped = this.data('scry-flipped') || false;
        this.transition({ rotate : (flipped ? '-' : '+') + '=180' })
            .queue(function() {
                $(this).css({
                    'background-image' : 'url(' + IMAGE_URL + card.multiverseid
                        + (flipped ? '' : '&options=rotate180') + ')',
                    'rotate' : 0
                }).toggleClass('scry-flipped', !flipped).dequeue();
                oracleConstruct.apply($(this).find('.scry-oracle'), [ flipped ? card : card.other ]);
            }).data('scry-flipped', !flipped);
    }

    function transform(card) {
        var transformed = this.data('scry-transformed'),
            op = transformed ? '-' : '+',
            c = transformed ? card : card.other;
        this.transition({
            duration : 200,
            easing : 'in',
            perspective : 250,
            rotateY : op + '=90'
        }).queue(function() {
            $(this).css({
                'background-image' : 'url(' + IMAGE_URL + c.multiverseid + ')',
                scale : [ (transformed ? 1 : -1), 1 ]
            }).dequeue();
            oracleConstruct.apply($(this).find('.scry-oracle'), [ transformed ? card : card.other ]);
        }).transition({
            duration : 200,
            easing : 'out',
            perspective : 250,
            rotateY : op + '=90'
        }).data('scry-transformed', !transformed);
    }

    function content(card) {
        this.css({
            'background-image' : 'url(' + IMAGE_URL + card.multiverseid +
                (card.layout === 'split' ? '&options=rotate90' : '') + ')',
            'border-color' : card.border
        }).toggleClass('scry-alpha', card.setcode === 'LEA');
        $.when(prices(card)).done($.proxy(pricesConstruct, this.find('.scry-prices')));
        this.find('.scry-oracle.scry-right').remove();
        oracleConstruct.apply(this.find('.scry-oracle').removeClass('scry-left'), [ card ]);
        rulingsConstruct.apply(this.find('.scry-rulings'), [ card ]);
        printingsConstruct.apply(this.find('.scry-printings'), [ card ]);

        if (card.layout === 'split') {
            var other = this.find('.scry-oracle').clone().addClass('scry-right');
            oracleConstruct.apply(other, [ card.other ]);
            this.find('.scry-oracle').addClass('scry-left').after(other);
        }
    }

    function oracleConstruct(card) {
        var self = this;
        self.find('div').empty();
        $.each(card, function(prop, value) {
            var s = self.find('.scry-oracle-' + prop);
            if (prop === 'text') value = value.replace(/\n/g, '<BR/>').replace(/(\(.*\))/g, function(m) {
                return '<i>' + m + '</i>';
            });
            s.html(value);
        });
        $.each([ 'power', 'toughness', 'loyalty' ], function(i, prop) {
            if (!card[prop]) self.find('.scry-oracle-' + prop).remove();
        });
    }

    function pricesConstruct(prices) {
        var self = this, template = TEMPLATES.find('.scry-vendor');
        self.find('.scry-vendor').empty();
        self.find('.scry-prices-link').on('click.scry', function() {
            window.open(prices.link);
        });
        $.each(prices.range, function(prop, value) {
            self.find('.scry-prices-range .scry-prices-' + prop).text(value);
        });
        $.each(prices.vendors, function(i, vendor) {
            var v = template.clone().data('scry-vendor', vendor);
            $.each(vendor, function(prop, value) {
                v.find('.scry-vendor-' + prop).text(value);
            });
            v.find('.scry-vendor-name').on('click.scry', function() {
                window.open(vendor.link);
            });
            self.find('.scry-vendors').append(v);
        });
    }

    function rulingsConstruct(card) {
        if (!card.rulings) return;
        var rulings = this.find('ul'),
            template = TEMPLATES.find('.scry-ruling');
        rulings.find('li').remove();
        $.each(card.rulings, function(i, ruling) {
            var r = template.clone().data('scry-ruling', ruling);
            $.each(ruling, function(prop, value) {
                r.find('.scry-ruling-' + prop).text(value);
            });
            rulings.append(r);
        });
    }

    function printingsConstruct(card) {
        var printings = this.find('ul').off('.scry'),
            template = TEMPLATES.find('.scry-printing'),
            sets = $.merge([], card.sets);
        if (card.other) $.merge(sets, card.other.sets);
        printings.find('li').remove();
        $.each(sets, function(i, set) {
            var p = template.clone().data('scry-set', set);
            $.each(set, function(prop, value) {
                p.find('.scry-printing-' + prop).text(value);
            });
            p.find('.scry-printing-number').toggle(set.number !== undefined);
            printings.append(p);
        });
        printings.on('click.scry', '.scry-printing', function(e) {
            var set = $(this).data('scry-set');
            if (set.setcode === card.setcode) return;
            $.extend(true, card, set);
            content.apply($(this).parents('.scry'), [ card ]);
        });
    }

    function construct(card) {
        var scry = TEMPLATES.find('.scry').clone().data('card', card);
        content.apply(scry, [ card ]);

        if (card.layout === 'flip')
            scry.find('.scry-flip').on('click.scry', $.proxy(flip, scry, card)).show();
        else if (card.layout === 'double-faced')
            scry.find('.scry-transform').on('click.scry', $.proxy(transform, scry, card)).show();

        scry.find('.scry-info-toggle').on('click.scry', function() {
            scry.find('.scry-info').slideToggle();
        });
        scry.find('.scry-tabs>li').on('click.scry', function() {
            var type = $(this).text().toLowerCase();
            $(this).addClass('scry-active').siblings().removeClass('scry-active');
            scry.find('.scry-panels .scry-' + type).show()
                .siblings().filter(':not(.scry-' + type + ')').hide();
        });
        return scry.toggleClass('scry-split', card.layout === 'split').appendTo('body');
    }

    function attach(scry) {
        $(this).data('scry', scry);
        $(this).on('mouseenter.scry', show).on('mouseleave.scry', hide);
        scry.on('mouseenter.scry', $.proxy(clearTimeout, this))
            .on('mouseleave.scry', $.proxy(hide, this));
        return scry;
    }

    function init(e) {
        var query = e.data.query.apply(this);
        if (!query) return;
        if (typeof query === 'string') query = { name : query };
        else if (typeof query === 'number') query = { multiverseid : query };
        $.when(oracle(query))
            .then(construct)
            .then($.proxy(attach, this))
            .done($.proxy(show, this, e));
    }

    function receive(msg) {
        var temp = $('<div></div>'),
            e = $('body').data('scry-event');
        $.when(oracle(msg))
            .then(construct)
            .then($.proxy(attach, temp))
            .done($.proxy(show, temp, e));
    }

    $.fn.scry = function(options) {
        var settings = $.extend({
            query : function() { return $(this).text() },
            selector : null
        }, options);

        _.runtime.sendMessage({ type : 'init' });
        _.runtime.onMessage.addListener(receive);
        $('body').on('mouseup', function(e) {
            $(this).data('scry-event', e);
        });
        return this.each(function() {
            $(this).on('mouseover.scry', settings.selector, settings,
                function(e) {
                    if ($(this).data('scry')) return;
                    init.apply(this, [ e ]);
                });
        });
    }


})(jQuery, chrome);
