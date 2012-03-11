(function() {
  var AutoReloader, ListContainerView, ListViewSpinner, Manager, NewList, ReloadTimer, SearchForm, Tweet, TweetCollection, TweetListView, TweetView, TwitterSeach, TwitterSeachCollection, TwitterSearches, WidthChanger, api, deck, wait,
    __hasProp = Object.prototype.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor; child.__super__ = parent.prototype; return child; },
    __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };

  deck = $.TmplDeck('templates.html');

  $.fn.linkBlankify = function() {
    return this.each(function() {
      return $(this).find('a').each(function() {
        return $(this).attr('target', '_blank');
      });
    });
  };

  $.fn.shake = function() {
    return this.each(function() {
      var n;
      n = 30;
      return $(this).stop().animate({
        left: "-6px"
      }, n).animate({
        left: "6px"
      }, n).animate({
        left: "-6px"
      }, n).animate({
        left: "6px"
      }, n).animate({
        left: "0px"
      }, n);
    });
  };

  wait = function(milli) {
    return $.Deferred(function(defer) {
      return setTimeout(function() {
        return defer.resolve();
      }, milli || 0);
    }).promise();
  };

  twttr.formatDate = function(dateString) {
    var d, date, hour, min, month, ret, year;
    d = new Date(dateString);
    year = d.getFullYear();
    if (year !== year) {
      d = new Date(dateString.replace(/^([^ ]+) ([^ ]+) ([^ ]+) ([^ ]+) ([^ ]+) ([^ ]+)$/, '$1, $3 $2 $6 $4 $5'));
      year = d.getFullYear();
    }
    month = d.getMonth() + 1;
    date = d.getDate();
    hour = d.getHours();
    min = d.getMinutes();
    return ret = "" + year + "/" + month + "/" + date + " " + hour + ":" + min;
  };

  api = {};

  api.searchTweets = function(query) {
    var req, ret;
    req = null;
    ret = $.Deferred(function(defer) {
      return req = $.ajax({
        url: 'http://search.twitter.com/search.json',
        dataType: 'jsonp',
        data: {
          result_type: 'recent',
          rpp: 100,
          page: 1,
          q: query
        }
      }).pipe(function(res) {
        return defer.resolve(res, function() {
          return defer.reject().always(function() {
            return req = null;
          });
        });
      });
    }).promise();
    ret.abort = function() {
      if (req != null) req.abort();
      return ret;
    };
    return ret;
  };

  Manager = (function() {

    function Manager() {}

    _.extend(Manager.prototype, Backbone.Events);

    Manager.prototype.add = function(item) {
      if (this.items == null) this.items = [];
      this.items.push(item);
      return this.trigger('sizechange', this.size());
    };

    Manager.prototype.reset = function() {
      this.items = [];
      return this;
    };

    Manager.prototype.size = function() {
      if (this.items) {
        return this.items.length;
      } else {
        return 0;
      }
    };

    Manager.prototype.remove = function(item) {
      this.items = _.without(this.items, item);
      this.trigger('sizechange', this.size());
      return this;
    };

    return Manager;

  })();

  Tweet = (function(_super) {

    __extends(Tweet, _super);

    function Tweet() {
      Tweet.__super__.constructor.apply(this, arguments);
    }

    return Tweet;

  })(Backbone.Model);

  TweetCollection = (function(_super) {

    __extends(TweetCollection, _super);

    function TweetCollection() {
      TweetCollection.__super__.constructor.apply(this, arguments);
    }

    TweetCollection.prototype.model = Tweet;

    return TweetCollection;

  })(Backbone.Collection);

  TwitterSeach = (function(_super) {

    __extends(TwitterSeach, _super);

    function TwitterSeach() {
      TwitterSeach.__super__.constructor.apply(this, arguments);
    }

    TwitterSeach.prototype.update = function() {
      var _this = this;
      this.trigger('searchstart');
      this.updateDefer = api.searchTweets(this.get('query'));
      this.updateDefer.pipe(function(res) {
        _this.tweets = new TweetCollection(res.results);
        return _this.trigger('success');
      }, function() {
        return _this.trigger('error');
      });
      return this.updateDefer;
    };

    TwitterSeach.prototype.destroy = function() {
      var _ref;
      if ((_ref = this.updateDefer) != null) _ref.abort();
      TwitterSeach.__super__.destroy.apply(this, arguments);
      return this;
    };

    return TwitterSeach;

  })(Backbone.Model);

  TwitterSeachCollection = (function(_super) {

    __extends(TwitterSeachCollection, _super);

    function TwitterSeachCollection() {
      TwitterSeachCollection.__super__.constructor.apply(this, arguments);
    }

    TwitterSeachCollection.prototype.model = TwitterSeach;

    TwitterSeachCollection.prototype.localStorage = new Store('twittersearch');

    TwitterSeachCollection.prototype.loadCached = function() {
      var _this = this;
      return _.each(this.localStorage.findAll(), function(data) {
        return _this.add(data);
      });
    };

    TwitterSeachCollection.prototype.updateCache = function(twitterSearch) {
      if (this.localStorage.find(twitterSearch)) {
        this.localStorage.update(twitterSearch);
      } else {
        this.localStorage.create(twitterSearch);
      }
      this.localStorage.save();
      return this;
    };

    TwitterSeachCollection.prototype.add = function(options) {
      var twitterSearch;
      twitterSearch = new this.model(options);
      TwitterSeachCollection.__super__.add.call(this, twitterSearch);
      this.updateCache(twitterSearch);
      return this;
    };

    TwitterSeachCollection.prototype.updateAllSearches = function() {
      this.each(function(model) {
        return model.update();
      });
      return this;
    };

    return TwitterSeachCollection;

  })(Backbone.Collection);

  TwitterSearches = new TwitterSeachCollection;

  ListViewSpinner = (function() {

    function ListViewSpinner($parent) {
      var options, spinner;
      options = {
        color: '#fff',
        length: 20,
        radius: 30
      };
      spinner = (new Spinner(options)).spin($parent[0]);
      this.el = spinner.el;
      this.$el = $(spinner.el);
    }

    return ListViewSpinner;

  })();

  WidthChanger = (function(_super) {

    __extends(WidthChanger, _super);

    function WidthChanger() {
      WidthChanger.__super__.constructor.apply(this, arguments);
    }

    WidthChanger.prototype.options = {
      widthPerItem: 300
    };

    WidthChanger.prototype.initialize = function() {
      return this.update(1);
    };

    WidthChanger.prototype.update = function(size) {
      return this.$el.width(this.options.widthPerItem * (size + 1));
    };

    return WidthChanger;

  })(Backbone.View);

  NewList = (function(_super) {

    __extends(NewList, _super);

    function NewList() {
      this.toggle = __bind(this.toggle, this);
      NewList.__super__.constructor.apply(this, arguments);
    }

    NewList.prototype.events = {
      'click .mod-newlist-btn': 'toggle'
    };

    NewList.prototype.initialize = function() {
      return this.els = {
        content_closed: this.$('.mod-newlist-content-closed'),
        content_opened: this.$('.mod-newlist-content-opened')
      };
    };

    NewList.prototype.toggle = function() {
      return this.$el.toggleClass('state-close state-open');
    };

    return NewList;

  })(Backbone.View);

  SearchForm = (function(_super) {

    __extends(SearchForm, _super);

    function SearchForm() {
      this._submitHandler = __bind(this._submitHandler, this);
      SearchForm.__super__.constructor.apply(this, arguments);
    }

    SearchForm.prototype.events = {
      'submit': '_submitHandler'
    };

    SearchForm.prototype.initialize = function() {
      return this.els = {
        input: this.$('input[type=search]')
      };
    };

    SearchForm.prototype._submitHandler = function(e) {
      var val;
      e.preventDefault();
      val = this.els.input.val();
      if (!val) return;
      return this.trigger('submit', val);
    };

    return SearchForm;

  })(Backbone.View);

  TweetView = (function(_super) {

    __extends(TweetView, _super);

    function TweetView() {
      TweetView.__super__.constructor.apply(this, arguments);
    }

    TweetView.prototype.className = 'mod-tweetitem';

    TweetView.prototype.render = function() {
      this.$el.html(deck.tmpl('TweetView', this.model.toJSON()));
      return this;
    };

    return TweetView;

  })(Backbone.View);

  TweetListView = (function(_super) {

    __extends(TweetListView, _super);

    function TweetListView() {
      TweetListView.__super__.constructor.apply(this, arguments);
    }

    TweetListView.prototype.className = 'mod-tweetlist';

    TweetListView.prototype.events = {
      'click .mod-tweetlist-util-reload': 'reload',
      'click .mod-tweetlist-remove': 'remove'
    };

    TweetListView.prototype.initialize = function() {
      this.els = {};
      return this.manager = new Manager;
    };

    TweetListView.prototype.refreshTweets = function() {
      var _this = this;
      if (this.model.tweets.length) {
        this.model.tweets.each(function(tweet) {
          var view;
          view = new TweetView({
            model: tweet
          });
          _this.manager.add(view);
          return _this.els.bd.append((view.render().el));
        });
      } else {
        this.els.bd.append(deck.draw('TweetView-noresult'));
      }
      return this;
    };

    TweetListView.prototype.renderLoading = function() {
      var _this = this;
      this.$el.html(deck.tmpl('TweetListView-frame', this.model.toJSON()));
      this.els.bd = this.$('.mod-tweetlist-bd');
      wait(0).done(function() {
        var spinner;
        spinner = new ListViewSpinner(_this.els.bd);
        return _this.els.spinner = spinner.$el;
      });
      return this;
    };

    TweetListView.prototype.renderContent = function() {
      var _this = this;
      this.els.spinner.fadeOut(function() {
        _this.els.spinner.remove();
        _this.refreshTweets();
        return _this.els.bd.hide().fadeIn().linkBlankify();
      });
      return this;
    };

    TweetListView.prototype.renderError = function() {
      this.$el.html(deck.tmpl('TweetListView-error'));
      return this;
    };

    TweetListView.prototype.reload = function() {
      return this.model.update();
    };

    TweetListView.prototype.remove = function() {
      var _this = this;
      this.$el.fadeOut(400, 'easeOutExpo', function() {
        _this.model.destroy();
        _this.manager.reset();
        _this.$el.remove();
        return _this.trigger('remove', _this);
      });
      return this;
    };

    return TweetListView;

  })(Backbone.View);

  ListContainerView = (function(_super) {

    __extends(ListContainerView, _super);

    function ListContainerView() {
      this.addOne = __bind(this.addOne, this);
      ListContainerView.__super__.constructor.apply(this, arguments);
    }

    ListContainerView.prototype.initialize = function() {
      var _this = this;
      this.manager = new Manager;
      this.els = {
        inner: this.$('.mod-listcontainer-inner'),
        items: this.$('.mod-listcontainer-items')
      };
      this.widthChanger = new WidthChanger({
        el: this.els.inner
      });
      this.manager.bind('sizechange', function(size) {
        return _this.widthChanger.update(size);
      });
      return TwitterSearches.bind('add', this.addOne);
    };

    ListContainerView.prototype.addOne = function(twitterSearch) {
      var model, view,
        _this = this;
      model = twitterSearch;
      view = new TweetListView({
        model: model
      });
      this.manager.add(view);
      view.bind('remove', function() {
        return _this.manager.remove(view);
      });
      model.bind('searchstart', function() {
        return view.renderLoading();
      });
      model.bind('success', function() {
        return view.renderContent();
      });
      model.bind('error', function() {
        return view.renderError();
      });
      model.update();
      this.els.items.append(view.el);
      return this;
    };

    return ListContainerView;

  })(Backbone.View);

  ReloadTimer = (function() {

    _.extend(ReloadTimer.prototype, Backbone.Events);

    ReloadTimer.prototype._tickDefer = null;

    function ReloadTimer(interval) {
      this.interval = this.counter = interval;
    }

    ReloadTimer.prototype.tick = function() {
      var currentTick,
        _this = this;
      currentTick = {
        paused: false,
        tick: function() {
          return wait(1000).done(function() {
            if (currentTick.paused) return;
            _this.counter--;
            _this.trigger('tick', _this.counter);
            if (_this.counter === 0) {
              _this.counter = _this.interval + 1;
              _this.trigger('hitzero');
            }
            return _this.tick();
          });
        },
        destroy: function() {
          return currentTick.paused = true;
        }
      };
      currentTick.tick();
      this._currentTick = currentTick;
      return this;
    };

    ReloadTimer.prototype.resume = function() {
      var _ref;
      if ((_ref = this._currentTick) != null) _ref.destroy();
      this.tick();
      return this;
    };

    ReloadTimer.prototype.pause = function() {
      var _ref;
      if ((_ref = this._currentTick) != null) _ref.destroy();
      return this;
    };

    ReloadTimer.prototype.reset = function(interval) {
      if (interval) this.interval = interval;
      this.counter = this.interval + 1;
      return this;
    };

    return ReloadTimer;

  })();

  AutoReloader = (function(_super) {

    __extends(AutoReloader, _super);

    function AutoReloader() {
      this._keydownHandler = __bind(this._keydownHandler, this);
      this.escInput = __bind(this.escInput, this);
      this.toInput = __bind(this.toInput, this);
      AutoReloader.__super__.constructor.apply(this, arguments);
    }

    AutoReloader.prototype.events = {
      'focus': 'toInput',
      'blur': 'escInput',
      'keydown': '_keydownHandler'
    };

    AutoReloader.prototype.initialize = function() {
      var interval,
        _this = this;
      interval = 360;
      this.timer = new ReloadTimer(interval);
      this.$el.val(interval);
      this.timer.bind('tick', function(time) {
        return _this.$el.val(time);
      });
      this.timer.bind('hitzero', function() {
        return _this.trigger('hitzero');
      });
      return this.timer.resume();
    };

    AutoReloader.prototype.toInput = function() {
      this._lastVal = this.$el.val();
      this.$el.addClass('state-input');
      this.timer.pause();
      return this;
    };

    AutoReloader.prototype.escInput = function() {
      var num, val;
      this.$el.removeClass('state-input');
      val = this.$el.val();
      if (val !== this._lastVal) {
        if (/^\d+$/.test(val)) {
          num = parseInt(val, 10);
          this.timer.reset(num);
        } else {
          this.$el.shake();
          this.$el.val(this.timer.counter);
        }
      }
      this.timer.resume();
      return this;
    };

    AutoReloader.prototype.reset = function() {
      return this.timer.reset();
    };

    AutoReloader.prototype._keydownHandler = function(e) {
      if (e.keyCode === 13) this.$el.trigger('blur');
      return this;
    };

    return AutoReloader;

  })(Backbone.View);

  deck.load().done(function() {
    return $(function() {
      var autoreloader, listcontainer, newlist, searchform;
      newlist = new NewList({
        el: $('#newlist')
      });
      listcontainer = new ListContainerView({
        el: $('#listcontainer')
      });
      searchform = new SearchForm({
        el: $('#searchform')
      });
      autoreloader = new AutoReloader({
        el: $('#autoreloader')
      });
      searchform.bind('submit', function(query) {
        return TwitterSearches.add({
          query: query
        });
      });
      autoreloader.bind('hitzero', function() {
        return TwitterSearches.updateAllSearches();
      });
      $('#reloadall').click(function() {
        autoreloader.reset();
        return TwitterSearches.updateAllSearches();
      });
      return TwitterSearches.loadCached();
    });
  });

}).call(this);
