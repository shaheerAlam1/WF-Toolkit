# WF-Toolkit


# How to use in iframe Modal in Webflow

## A) Judge.me link (auto-popup)

```html
<div model-iframe_url="https://judge.me/reviews/your-product-link"></div>
<a href="#" model-trigger="review">Write a review</a>
<!-- Will open a centered popup, since domain is judge.me -->
```

## B) Force popup for any URL

```html
<div model-iframe_url="https://example.com/some-form"></div>
<button model-trigger="x" model-open="popup">Open as popup</button>
```

## C) Still want iframe for embeddable URLs

```html
<div model-iframe_url="https://player.vimeo.com/video/12345"></div>
<button model-trigger="demo" model-open="iframe">Open in iframe modal</button>
```
